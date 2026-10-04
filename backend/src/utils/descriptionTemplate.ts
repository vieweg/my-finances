export interface DescriptionTemplateContext {
  contactName: string;
  instalmentNumber: number;
  totalInstalments: number; // 0 = unlimited
  dueDate: Date;
  cycleMonths: number;
  amount: number;
  currency: string;
}

function fmtDate(d: Date): string {
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function renderDescription(template: string, ctx: DescriptionTemplateContext): string {
  const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(ctx.dueDate);

  const instalment =
    ctx.totalInstalments > 0
      ? `${ctx.instalmentNumber} of ${ctx.totalInstalments}`
      : String(ctx.instalmentNumber);

  const value = new Intl.NumberFormat('en', { style: 'currency', currency: ctx.currency }).format(ctx.amount);

  const periodStart = ctx.dueDate;
  const periodEndMs = new Date(ctx.dueDate);
  periodEndMs.setUTCMonth(periodEndMs.getUTCMonth() + ctx.cycleMonths);
  periodEndMs.setUTCDate(periodEndMs.getUTCDate() - 1);
  const period = `${fmtDate(periodStart)} - ${fmtDate(periodEndMs)}`;

  return template
    .split('[month]').join(month)
    .split('[instalment]').join(instalment)
    .split('[contact_name]').join(ctx.contactName)
    .split('[value]').join(value)
    .split('[period]').join(period);
}
