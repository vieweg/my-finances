import dotenv from 'dotenv';
dotenv.config();

import * as mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// ── value mappers ──────────────────────────────────────────────────────────────

const CURRENCY = process.env.LEGACY_CURRENCY || 'GBP';

function signedToTransactionType(value: number): 'income' | 'outcome' {
  return value >= 0 ? 'income' : 'outcome';
}

function signedToInvoiceType(value: number): 'receivable' | 'payable' {
  return value >= 0 ? 'receivable' : 'payable';
}

function unsigned(value: number): number {
  return Math.abs(value);
}

function mapFaturaStatus(status: string): string {
  return status === 'fechada' ? 'paid' : 'pending';
}

function mapContratoStatus(status: string): 'active' | 'completed' | 'cancelled' {
  return status === 'concluido' ? 'completed' : 'active';
}

function dt(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  // dateStrings:true on the legacy connection returns strings already formatted
  // as 'YYYY-MM-DD HH:MM:SS' — pass them straight through to avoid UTC shifting.
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function migrateTags(description: string | null | undefined): string | null {
  if (!description) return description ?? null;
  return description
    .split('[cliente]').join('[contact_name]')
    .split('[periodo]').join('[period]')
    .split('[mes]').join('[month]')
    .split('[valor]').join('[value]');
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  const legacy = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.LEGACY_DB_PORT || process.env.DB_PORT) || 3306,
    user: process.env.LEGACY_DB_USER || process.env.DB_USER,
    password: process.env.LEGACY_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME || 'controle_london',
    dateStrings: true,
    timezone: 'Z',
  });

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: false,
    timezone: 'Z',
  });

  await legacy.execute("SET time_zone = '+00:00'");
  await db.execute("SET time_zone = '+00:00'");

  const email = process.env.IMPORT_USER_EMAIL;
  const [users] = email
    ? await db.execute<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    : await db.execute<mysql.RowDataPacket[]>('SELECT id FROM users LIMIT 1');
  if (!users.length) throw new Error(email ? `User not found: ${email}` : 'No user found. Create one first via the API.');
  const userId = users[0].id as string;
  console.log(`Importing into user: ${userId}\n`);

  const now = dt(new Date())!;

  const tagMap = new Map<number, string>();
  const walletMap = new Map<number, string>();
  const contactMap = new Map<number, string>();
  const contractMap = new Map<number, string>();
  const invoiceMap = new Map<number, string>();
  const transactionMap = new Map<number, string>();

  await db.beginTransaction();

  try {
    // 1. tags ──────────────────────────────────────────────────────────────────
    process.stdout.write('tags ... ');
    const [tags] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM tag');
    for (const row of tags) {
      const id = uuidv4();
      tagMap.set(row.id as number, id);
      await db.execute(
        'INSERT INTO tags (id, userId, name, createdAt, updatedAt) VALUES (?,?,?,?,?)',
        [id, userId, row.nome, now, now],
      );
    }
    console.log(`${tags.length}`);

    // 2. wallets (carteira) ────────────────────────────────────────────────────
    process.stdout.write('wallets ... ');
    const [wallets] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM carteira');
    for (const row of wallets) {
      const id = uuidv4();
      walletMap.set(row.id as number, id);
      await db.execute(
        'INSERT INTO wallets (id, userId, name, currency, position, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
        [id, userId, row.nome, CURRENCY, row.posicao, now, now],
      );
    }
    console.log(`${wallets.length}`);

    // 3. contacts (pessoas) ────────────────────────────────────────────────────
    process.stdout.write('contacts ... ');
    const [pessoas] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM pessoas');
    for (const row of pessoas) {
      const id = uuidv4();
      contactMap.set(row.id as number, id);
      const deletedAt = row.ativo ? null : now;
      await db.execute(
        'INSERT INTO contacts (id, userId, name, document, email, phone, notes, createdAt, updatedAt, deletedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [id, userId, row.nome, row.documento || null, row.email || null, row.telefones || null, row.observacoes || null, dt(row.data_cadastro) || now, now, deletedAt],
      );
    }
    console.log(`${pessoas.length}`);

    // 4. contracts (contrato) ──────────────────────────────────────────────────
    process.stdout.write('contracts ... ');
    const [contratos] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM contrato');
    for (const row of contratos) {
      const id = uuidv4();
      contractMap.set(row.id as number, id);

      const [paidRows] = await legacy.execute<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS cnt FROM fatura WHERE contrato_id = ? AND status = 'fechada'",
        [row.id],
      );
      const instalmentsDone = Number((paidRows[0] as mysql.RowDataPacket).cnt);

      const firstDueDate = new Date(row.data_inicio as string);
      const nextDueDate = addMonths(firstDueDate, instalmentsDone * (row.ciclo as number));

      const contactId = row.cliente_id ? (contactMap.get(row.cliente_id as number) ?? null) : null;
      const walletId = row.carteira_id ? (walletMap.get(row.carteira_id as number) ?? null) : null;
      const name = (row.descricao as string).slice(0, 150);

      await db.execute(
        `INSERT INTO contracts
           (id, userId, contactId, walletId, name, type, amount, currency, description,
            instalments, instalmentsDone, cycleMonths, firstDueDate, nextDueDate, status,
            createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, userId, contactId, walletId, name,
          signedToInvoiceType(Number(row.valor)), unsigned(Number(row.valor)), CURRENCY, migrateTags(row.descricao as string),
          row.numParcelas, instalmentsDone, row.ciclo,
          dt(firstDueDate), dt(nextDueDate),
          mapContratoStatus(row.status as string),
          dt(row.data_cadastro) || now, now,
        ],
      );
    }
    console.log(`${contratos.length}`);

    // 4b. contract tags ────────────────────────────────────────────────────────
    process.stdout.write('contract tags ... ');
    const [contratoTags] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM contrato_tag');
    let contractTagCount = 0;
    for (const row of contratoTags) {
      const contractId = contractMap.get(row.contrato_id as number);
      const tagId = tagMap.get(row.tag_id as number);
      if (!contractId || !tagId) continue;
      await db.execute('INSERT INTO contract_tags (contract_id, tag_id) VALUES (?,?)', [contractId, tagId]);
      contractTagCount++;
    }
    console.log(`${contractTagCount}`);

    // 5. invoices (fatura) ─────────────────────────────────────────────────────
    process.stdout.write('invoices ... ');
    const [faturas] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM fatura');
    for (const row of faturas) {
      const id = uuidv4();
      invoiceMap.set(row.id as number, id);

      const contactId = row.cliente_id ? (contactMap.get(row.cliente_id as number) ?? null) : null;
      const walletId = row.carteira_id ? (walletMap.get(row.carteira_id as number) ?? null) : null;
      const contractId = row.contrato_id ? (contractMap.get(row.contrato_id as number) ?? null) : null;
      const status = mapFaturaStatus(row.status as string);

      const history = JSON.stringify([{
        event: 'created',
        at: dt(row.data_cadastro) || now,
        status,
      }]);

      await db.execute(
        `INSERT INTO invoices
           (id, userId, contactId, walletId, contractId, type, status, amount, currency,
            issueDate, dueDate, description, history, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, userId, contactId, walletId, contractId,
          signedToInvoiceType(Number(row.valor_total)), status,
          unsigned(Number(row.valor_total)), CURRENCY,
          dt(row.data_cadastro) || now, dt(row.vencimento) || now,
          migrateTags(row.descricao as string), history,
          dt(row.data_cadastro) || now, now,
        ],
      );
    }
    console.log(`${faturas.length}`);

    // 5b. invoice tags ─────────────────────────────────────────────────────────
    process.stdout.write('invoice tags ... ');
    const [faturaTags] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM fatura_tag');
    let invoiceTagCount = 0;
    for (const row of faturaTags) {
      const invoiceId = invoiceMap.get(row.fatura_id as number);
      const tagId = tagMap.get(row.tag_id as number);
      if (!invoiceId || !tagId) continue;
      await db.execute('INSERT INTO invoice_tags (invoice_id, tag_id) VALUES (?,?)', [invoiceId, tagId]);
      invoiceTagCount++;
    }
    console.log(`${invoiceTagCount}`);

    // 6. transactions (transacao) ──────────────────────────────────────────────
    process.stdout.write('transactions ... ');
    const [transacoes] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM transacao');
    for (const row of transacoes) {
      const id = uuidv4();
      transactionMap.set(row.id as number, id);

      const walletId = row.carteira_id ? (walletMap.get(row.carteira_id as number) ?? null) : null;
      const invoiceId = row.fatura_id ? (invoiceMap.get(row.fatura_id as number) ?? null) : null;

      await db.execute(
        `INSERT INTO transactions
           (id, originalId, version, userId, total, currency, date, description, type,
            walletId, invoiceId, createdAt, updatedAt)
         VALUES (?,NULL,1,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, userId,
          unsigned(Number(row.valor_total)), CURRENCY,
          dt(row.data_cadastro) || now,
          row.descricao,
          signedToTransactionType(Number(row.valor_total)),
          walletId, invoiceId,
          dt(row.data_cadastro) || now, now,
        ],
      );
    }
    console.log(`${transacoes.length}`);

    // 6b. transaction tags ─────────────────────────────────────────────────────
    process.stdout.write('transaction tags ... ');
    const [transacaoTags] = await legacy.execute<mysql.RowDataPacket[]>('SELECT * FROM transacao_tag');
    let txTagCount = 0;
    for (const row of transacaoTags) {
      const txId = transactionMap.get(row.transacao_id as number);
      const tagId = tagMap.get(row.tag_id as number);
      if (!txId || !tagId) continue;
      await db.execute('INSERT INTO transactions_tags (transaction_id, tag_id) VALUES (?,?)', [txId, tagId]);
      txTagCount++;
    }
    console.log(`${txTagCount}`);

    // 7. wallet snapshots (carteira_valor) ────────────────────────────────────
    process.stdout.write('wallet snapshots ... ');
    const [snapshots] = await legacy.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM carteira_valor ORDER BY carteira_id, data_cadastro ASC',
    );
    let prevCarteiraId: number | null = null;
    let prevAmount = 0;
    let snapshotCount = 0;
    for (const row of snapshots) {
      const walletId = walletMap.get(row.carteira_id as number);
      if (!walletId) continue;

      const amount = Number(row.valor);
      const delta = row.carteira_id === prevCarteiraId ? amount - prevAmount : amount;
      prevCarteiraId = row.carteira_id as number;
      prevAmount = amount;

      await db.execute(
        `INSERT INTO wallet_snapshots (id, walletId, amount, delta, source, transactionId, recordedAt, createdAt)
         VALUES (?,?,?,?,'manual',NULL,?,?)`,
        [uuidv4(), walletId, amount, delta, dt(row.data_cadastro) || now, now],
      );
      snapshotCount++;
    }
    console.log(`${snapshotCount}`);

    await db.commit();
    console.log('\nImport complete.');
  } catch (err) {
    await db.rollback();
    console.error('\nImport failed — rolled back.');
    throw err;
  } finally {
    await legacy.end();
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
