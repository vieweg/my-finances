import cron from 'node-cron';
import { runBackup, BackupResult } from '../scripts/backup';
import { dataSource } from '../database';
import { User } from '../modules/users/models/user.model';
import EmailService from '../email/service';

async function sendLogEmail(subject: string, body: string): Promise<void> {
  if (process.env.SEND_LOGS !== 'true') return;

  const recipient = process.env.BREVO_FROM_EMAIL;
  const name = process.env.BREVO_FROM_NAME || 'Controle Caixa';
  if (!recipient) return;

  const html = `<pre style="font-family:monospace;font-size:14px">${body}</pre>`;
  try {
    await new EmailService().sendEmail({ email: recipient, name }, subject, html);
  } catch (err) {
    console.error('[BackupJob] Failed to send log email:', err);
  }
}

export function startBackupJob(): void {
  // Daily at 01:00
  cron.schedule('0 1 * * *', async () => {
    const startedAt = new Date();
    console.log('[BackupJob] Running at', startedAt.toISOString());

    const users = await dataSource
      .getRepository(User)
      .find({ select: ['id', 'username'], withDeleted: false });

    if (!users.length) {
      console.log('[BackupJob] No active users found, skipping.');
      return;
    }

    const results: BackupResult[] = [];
    const errors: { userId: string; message: string }[] = [];

    for (const user of users) {
      try {
        const result = await runBackup(user.id);
        results.push(result);
        console.log(`[BackupJob] [${user.username}] Written: ${result.filename} (${result.totalRows} rows)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ userId: user.id, message });
        console.error(`[BackupJob] [${user.username}] Error:`, err);
      }
    }

    const status = errors.length === 0 ? 'SUCCESS' : errors.length < users.length ? 'PARTIAL' : 'ERROR';
    const subject = `[BackupJob] ${status} — ${startedAt.toISOString().slice(0, 10)}`;
    const body = [
      `Run at:  ${startedAt.toISOString()}`,
      `Status:  ${status}`,
      `Users:   ${users.length} total, ${results.length} ok, ${errors.length} failed`,
      '',
      ...results.map(r =>
        `  ✓ ${r.userId}  ${r.filename}  ${r.totalRows} rows`
      ),
      ...errors.map(e => `  ✗ ${e.userId}  ${e.message}`),
    ].join('\n');

    await sendLogEmail(subject, body);
  });
}
