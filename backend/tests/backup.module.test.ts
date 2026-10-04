import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, SessionResponseDto, buildCreateUserPayload } from './global/setupTests';
import { runBackup, getUserBackupDir } from '../src/scripts/backup';
import app from '../src/app';

let session: SessionResponseDto;
const auth = () => ({ Authorization: `Bearer ${session.token}` });

const createUserSession = async (): Promise<SessionResponseDto> => {
  const { body: admin } = await request(app)
    .post('/api/sessions')
    .send({ username: adminUserCredentials.username, password: adminUserCredentials.password });
  const user = buildCreateUserPayload();
  await request(app).post('/api/users').set({ Authorization: `Bearer ${admin.token}` }).send(user);
  const { body } = await request(app).post('/api/sessions').send({ username: user.username, password: user.password });
  return body;
};

// Everything the user can see through the API, including soft-deleted items
const snapshot = async () => {
  const get = async (url: string) => (await request(app).get(url).set(auth())).body;
  return {
    transactions: await get('/api/transactions?limit=100'),
    deletedTransactions: await get('/api/transactions?limit=100&deleted=true'),
    invoices: await get('/api/invoices?limit=100'),
    deletedInvoices: await get('/api/invoices?limit=100&deleted=true'),
    contracts: await get('/api/contracts?limit=100&includeCompleted=true'),
    deletedContracts: await get('/api/contracts?limit=100&deleted=true'),
    contacts: await get('/api/contacts?limit=100'),
    wallets: await get('/api/wallets?limit=100'),
    tags: await get('/api/tags?limit=100'),
    deletedTags: await get('/api/tags?limit=100&deleted=true'),
  };
};

const restore = (filename: string) => request(app).post(`/api/backups/${filename}/restore`).set(auth());

const writeBackupFile = (filename: string, content: string) =>
  fs.writeFileSync(path.join(getUserBackupDir(session.user.id), filename), content, 'utf8');

beforeAll(async () => {
  session = await createUserSession();

  const { body: wallet } = await request(app).post('/api/wallets').set(auth()).send({ name: 'Main', currency: 'BRL' });
  const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
  await request(app).post(`/api/wallets/${wallet.id}/adjust`).set(auth()).send({ amount: 1000 });

  const { body: tx } = await request(app).post('/api/transactions').set(auth()).send({
    date: '2026-03-10T15:30:00.000Z',
    total: 120.5,
    description: 'groceries',
    type: 'outcome',
    walletId: wallet.id,
    tags: ['food', 'market'],
  });
  await request(app).put(`/api/transactions/${tx.id}`).set(auth()).send({
    date: '2026-03-10T15:30:00.000Z',
    total: 130.25,
    description: 'groceries (edited)',
    type: 'outcome',
    walletId: wallet.id,
    tags: ['food'],
  });

  const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send({
    contactId: contact.id,
    type: 'receivable',
    amount: 900,
    currency: 'BRL',
    issueDate: '2026-03-01T00:00:00.000Z',
    dueDate: '2026-03-31T00:00:00.000Z',
    description: 'consulting',
    tags: ['work'],
  });
  await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send({
    date: '2026-03-15T00:00:00.000Z',
    total: 400,
    walletId: wallet.id,
    description: 'first payment',
  });

  await request(app).post('/api/contracts').set(auth()).send({
    name: 'Rent',
    contactId: contact.id,
    type: 'payable',
    amount: 1350,
    currency: 'BRL',
    description: 'rent',
    instalments: 0,
    cycleMonths: 1,
    firstDueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['home'],
  });

  const { body: deletedTx } = await request(app).post('/api/transactions').set(auth()).send({
    date: '2026-02-01T00:00:00.000Z',
    total: 10,
    currency: 'BRL',
    description: 'deleted before backup',
    type: 'income',
  });
  await request(app).delete(`/api/transactions/${deletedTx.id}`).set(auth());
});

afterAll(() => {
  fs.rmSync(getUserBackupDir(session.user.id), { recursive: true, force: true });
});

describe('Backups', () => {
  it('should restore the user data to exactly the state of the backup', async () => {
    const before = await snapshot();
    const { filename } = await runBackup(session.user.id);

    // Change a bit of everything after the backup
    const wallet = before.wallets.data[0];
    const invoice = before.invoices.data[0];
    const contract = before.contracts.data[0];
    const contact = before.contacts.data[0];
    const tag = before.tags.data.find((t: any) => t.name === 'food');
    await request(app).post('/api/transactions').set(auth()).send({
      date: new Date().toISOString(),
      total: 999,
      description: 'created after backup',
      type: 'income',
      walletId: wallet.id,
      tags: ['new-tag'],
    });
    await request(app).delete(`/api/transactions/${before.transactions.data[0].id}`).set(auth());
    await request(app).delete(`/api/invoices/${invoice.id}/remove`).set(auth());
    await request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth());
    await request(app).put(`/api/contacts/${contact.id}`).set(auth()).send({ name: 'renamed after backup' });
    await request(app).delete(`/api/tags/${tag.id}`).set(auth());
    await request(app).post(`/api/wallets/${wallet.id}/adjust`).set(auth()).send({ amount: 5 });
    await request(app).patch(`/api/transactions/${before.deletedTransactions.data[0].id}/restore`).set(auth());

    const changed = await snapshot();
    expect(changed).not.toEqual(before);

    const { status, body } = await restore(filename);
    expect(status).toEqual(200);
    expect(body.filename).toEqual(filename);

    expect(await snapshot()).toEqual(before);
  });

  it('should list the backup files of the user as full backups', async () => {
    const { filename } = await runBackup(session.user.id);

    const { body, status } = await request(app).get('/api/backups').set(auth());
    expect(status).toEqual(200);
    expect(body.find((b: any) => b.filename === filename)).toMatchObject({ type: 'full' });
  });

  it('should keep the data untouched when the restore fails', async () => {
    const before = await snapshot();
    writeBackupFile(
      'backup_2000-01-01_000000.sql',
      `-- Backup generated at: 2000-01-01 00:00:00 UTC\n-- Type: full\n-- Database: x\n-- User: ${session.user.id}\n\nINSERT INTO not_a_table VALUES (1);\n`,
    );

    const { status } = await restore('backup_2000-01-01_000000.sql');
    expect(status).toEqual(500);
    expect(await snapshot()).toEqual(before);
  });

  it('should reject incremental backup files', async () => {
    writeBackupFile(
      'backup_2000-01-02_000000.sql',
      `-- Backup generated at: 2000-01-02 00:00:00\n-- Type: incremental (since 2000-01-01 00:00:00)\n-- Database: x\n-- User: ${session.user.id}\n`,
    );
    const { status } = await restore('backup_2000-01-02_000000.sql');
    expect(status).toEqual(400);
  });

  it('should reject a backup of another user', async () => {
    writeBackupFile(
      'backup_2000-01-03_000000.sql',
      `-- Backup generated at: 2000-01-03 00:00:00 UTC\n-- Type: full\n-- Database: x\n-- User: ${faker.string.uuid()}\n`,
    );
    const { status } = await restore('backup_2000-01-03_000000.sql');
    expect(status).toEqual(400);
  });

  it('should return 404 for a missing file and 400 for an invalid name', async () => {
    expect((await restore('backup_1999-01-01_000000.sql')).status).toEqual(404);
    expect((await restore('not-a-backup.sql')).status).toEqual(400);
  });

  it('should keep only the 5 newest files', async () => {
    const dir = getUserBackupDir(session.user.id);
    for (let i = 0; i < 6; i++) {
      writeBackupFile(`backup_2001-01-0${i + 1}_000000.sql`, '-- old');
    }
    await runBackup(session.user.id);

    const files = fs.readdirSync(dir).filter((f) => f.startsWith('backup_'));
    expect(files).toHaveLength(5);
    expect(files).not.toContain('backup_2000-01-01_000000.sql');
  });
});

describe('Backups taken before wallet snapshots had effectiveAt', () => {
  // Removes the effectiveAt column and its value from the wallet_snapshots inserts
  const withoutEffectiveAt = (sql: string) =>
    sql
      .split('\n')
      .map((line) => {
        const match = line.match(/^INSERT INTO `wallet_snapshots` \((.*)\) VALUES \((.*)\);$/);
        if (!match) return line;
        const cols = match[1].split(', ');
        const vals = match[2].split(', ');
        const idx = cols.indexOf('`effectiveAt`');
        cols.splice(idx, 1);
        vals.splice(idx, 1);
        return `INSERT INTO \`wallet_snapshots\` (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
      })
      .join('\n');

  it('should recompute effectiveAt when restoring', async () => {
    const { body: wallets } = await request(app).get('/api/wallets').set(auth());
    const wallet = wallets.data[0];
    const history = async () =>
      (await request(app).get(`/api/wallets/${wallet.id}/history?limit=100`).set(auth())).body.data.map((e: any) => ({
        id: e.id,
        effectiveAt: e.effectiveAt,
      }));

    const before = await history();
    expect(before.some((e: any) => e.effectiveAt === '2026-03-10T15:30:00.000Z')).toBe(true);

    const { filename } = await runBackup(session.user.id);
    const file = path.join(getUserBackupDir(session.user.id), filename);
    const sql = fs.readFileSync(file, 'utf8');
    expect(sql).toContain('`effectiveAt`');
    fs.writeFileSync(file, withoutEffectiveAt(sql), 'utf8');

    const { status } = await restore(filename);
    expect(status).toEqual(200);
    expect(await history()).toEqual(before);
  });
});
