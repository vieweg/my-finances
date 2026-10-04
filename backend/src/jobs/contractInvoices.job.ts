import cron from 'node-cron';
import GenerateContractInvoicesService from '../modules/contracts/services/generateInvoices.service';
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
    console.error('[ContractInvoicesJob] Failed to send log email:', err);
  }
}

export function startContractInvoicesJob(): void {
  cron.schedule('5 0 * * *', async () => {
    const startedAt = new Date();
    console.log('[ContractInvoicesJob] Running at', startedAt.toISOString());

    let generated = 0;
    let error: string | null = null;

    try {
      ({ generated } = await new GenerateContractInvoicesService().execute());
      console.log(`[ContractInvoicesJob] Generated ${generated} invoice(s)`);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error('[ContractInvoicesJob] Fatal error:', err);
    }

    const status = error ? 'ERROR' : 'SUCCESS';
    const subject = `[ContractInvoicesJob] ${status} — ${startedAt.toISOString().slice(0, 10)}`;
    const body = [
      `Run at:   ${startedAt.toISOString()}`,
      `Status:   ${status}`,
      `Generated: ${generated} invoice(s)`,
      ...(error ? [`Error:    ${error}`] : []),
    ].join('\n');

    await sendLogEmail(subject, body);
  });
}
