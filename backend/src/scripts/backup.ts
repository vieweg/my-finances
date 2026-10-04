import dotenv from 'dotenv';
process.env.NODE_ENV === 'test' ? dotenv.config({ path: '.env.test' }) : dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

// Every run writes a full snapshot of a user's data; the newest KEEP_FILES are kept (one per day with the daily job).
// Restoring a file puts the user's data back to exactly that state (see RestoreBackupService).

const BASE_BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const KEEP_FILES = 5;

export const BACKUP_FILE_REGEX = /^backup_\d{4}-\d{2}-\d{2}_\d{6}\.sql$/;

export function getUserBackupDir(userId: string): string {
  return path.join(BASE_BACKUP_DIR, userId);
}

// Formats in UTC: the connection runs with time_zone +00:00, so DATETIME values are UTC
function dt(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ');
  return d.toISOString().slice(0, 23).replace('T', ' ');
}

function esc(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    const s = dt(val);
    return s ? `'${s}'` : 'NULL';
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  const str = String(val);
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// Writes every selected column, so new columns are backed up without changes here
function insertRow(verb: 'INSERT' | 'INSERT IGNORE', table: string, row: mysql.RowDataPacket): string {
  const cols = Object.keys(row);
  const vals = cols.map(c => esc((row as Record<string, unknown>)[c]));
  return `${verb} INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${vals.join(', ')});`;
}

// A user's data, table by table: every row of the user, including soft-deleted ones
const USER_TABLES: Array<{ table: string; select: string }> = [
  { table: 'tags', select: 'SELECT * FROM tags WHERE userId = ?' },
  { table: 'wallets', select: 'SELECT * FROM wallets WHERE userId = ?' },
  {
    table: 'wallet_snapshots',
    select: 'SELECT ws.* FROM wallet_snapshots ws INNER JOIN wallets w ON ws.walletId = w.id WHERE w.userId = ?',
  },
  { table: 'contacts', select: 'SELECT * FROM contacts WHERE userId = ?' },
  { table: 'contracts', select: 'SELECT * FROM contracts WHERE userId = ?' },
  {
    table: 'contract_tags',
    select: 'SELECT ct.* FROM contract_tags ct INNER JOIN contracts c ON ct.contract_id = c.id WHERE c.userId = ?',
  },
  { table: 'invoices', select: 'SELECT * FROM invoices WHERE userId = ?' },
  {
    table: 'invoice_tags',
    select: 'SELECT it.* FROM invoice_tags it INNER JOIN invoices i ON it.invoice_id = i.id WHERE i.userId = ?',
  },
  { table: 'transactions', select: 'SELECT * FROM transactions WHERE userId = ?' },
  {
    table: 'transactions_tags',
    select: 'SELECT tt.* FROM transactions_tags tt INNER JOIN transactions t ON tt.transaction_id = t.id WHERE t.userId = ?',
  },
];

// Removes all of a user's data (not the user row). Join tables and snapshots go first because
// they are scoped through their parent rows. Run with FOREIGN_KEY_CHECKS = 0 inside a transaction.
export const CLEAR_USER_DATA_STATEMENTS = [
  'DELETE tt FROM transactions_tags tt INNER JOIN transactions t ON tt.transaction_id = t.id WHERE t.userId = ?',
  'DELETE it FROM invoice_tags it INNER JOIN invoices i ON it.invoice_id = i.id WHERE i.userId = ?',
  'DELETE ct FROM contract_tags ct INNER JOIN contracts c ON ct.contract_id = c.id WHERE c.userId = ?',
  'DELETE ws FROM wallet_snapshots ws INNER JOIN wallets w ON ws.walletId = w.id WHERE w.userId = ?',
  'DELETE FROM transactions WHERE userId = ?',
  'DELETE FROM invoices WHERE userId = ?',
  'DELETE FROM contracts WHERE userId = ?',
  'DELETE FROM contacts WHERE userId = ?',
  'DELETE FROM wallets WHERE userId = ?',
  'DELETE FROM tags WHERE userId = ?',
];

// Run after loading a backup: backups taken before wallet_snapshots.effectiveAt existed load it with
// the column default. Recomputes it the way the app keeps it (a no-op for newer backups): the
// adjustment date for manual entries, the latest version's date for transaction entries.
export const RECOMPUTE_EFFECTIVE_AT_STATEMENTS = [
  `UPDATE wallet_snapshots ws INNER JOIN wallets w ON w.id = ws.walletId
   SET ws.effectiveAt = ws.recordedAt
   WHERE w.userId = ? AND ws.source = 'manual'`,
  `UPDATE wallet_snapshots ws
   INNER JOIN wallets w ON w.id = ws.walletId
   INNER JOIN transactions t ON t.id = ws.transactionId
   INNER JOIN transactions latest
     ON COALESCE(latest.originalId, latest.id) = COALESCE(t.originalId, t.id)
     AND latest.version = (
       SELECT MAX(v.version) FROM transactions v
       WHERE COALESCE(v.originalId, v.id) = COALESCE(t.originalId, t.id)
     )
   SET ws.effectiveAt = latest.date
   WHERE w.userId = ?`,
];

export function createBackupConnection(options: { multipleStatements?: boolean } = {}) {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z',
    ...options,
  });
}

function pruneOldBackups(userId: string): void {
  const dir = getUserBackupDir(userId);
  const files = fs.readdirSync(dir)
    .filter(f => BACKUP_FILE_REGEX.test(f))
    .sort();
  const toDelete = files.slice(0, Math.max(0, files.length - KEEP_FILES));
  for (const f of toDelete) {
    fs.unlinkSync(path.join(dir, f));
    console.log(`[${userId}] Pruned old backup: ${f}`);
  }
}

export interface BackupResult {
  userId: string;
  filename: string;
  totalRows: number;
}

export async function runBackup(userId: string): Promise<BackupResult> {
  const dir = getUserBackupDir(userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const backupStartStr = dt(new Date())!.slice(0, 19);
  console.log(`[${userId}] Full backup`);

  const db = await createBackupConnection();
  await db.execute("SET time_zone = '+00:00'");

  const lines: string[] = [
    `-- Backup generated at: ${backupStartStr} UTC`,
    '-- Type: full',
    `-- Database: ${process.env.DB_NAME}`,
    `-- User: ${userId}`,
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
  ];

  let totalRows = 0;

  try {
    // The user row is only created when missing, so restoring never reverts e.g. a password change
    const [users] = await db.execute<mysql.RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [userId]);
    lines.push('-- users');
    for (const row of users) lines.push(insertRow('INSERT IGNORE', 'users', row));
    lines.push('');

    for (const { table, select } of USER_TABLES) {
      process.stdout.write(`[${userId}] ${table} ... `);
      const [rows] = await db.execute<mysql.RowDataPacket[]>(select, [userId]);
      lines.push(`-- ${table}`);
      for (const row of rows) lines.push(insertRow('INSERT', table, row));
      lines.push('');
      console.log(rows.length);
      totalRows += rows.length;
    }

    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    lines.push('');

    // Stamp row count into header before writing
    lines.splice(4, 0, `-- Rows: ${totalRows}`);

    const dateStr = backupStartStr.slice(0, 10);
    const timeStr = backupStartStr.slice(11).replace(/:/g, '');
    const filename = `backup_${dateStr}_${timeStr}.sql`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');

    const sizeKb = Math.ceil(fs.statSync(filepath).size / 1024);
    console.log(`[${userId}] Backup written: ${filename} (${sizeKb} KB, ${totalRows} rows)`);

    pruneOldBackups(userId);

    return { userId, filename, totalRows };
  } finally {
    await db.end();
  }
}

async function runBackupAllUsers(): Promise<void> {
  const db = await createBackupConnection();

  let userIds: string[];
  try {
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE deletedAt IS NULL',
    );
    userIds = rows.map(r => r.id as string);
  } finally {
    await db.end();
  }

  if (!userIds.length) {
    console.log('No active users found.');
    return;
  }

  for (const userId of userIds) {
    await runBackup(userId);
  }
}

if (require.main === module) {
  const userArg = process.argv.find(a => a.startsWith('--user='))?.split('=')[1];
  const task = userArg ? runBackup(userArg) : runBackupAllUsers();
  task.catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
