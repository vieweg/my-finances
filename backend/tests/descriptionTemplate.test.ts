import { describe, expect, it } from '@jest/globals';
import { renderDescription, DescriptionTemplateContext } from '../src/utils/descriptionTemplate';

const base: DescriptionTemplateContext = {
  contactName: 'João Silva',
  instalmentNumber: 3,
  totalInstalments: 12,
  dueDate: new Date('2026-01-20T00:00:00.000Z'),
  cycleMonths: 1,
  amount: 1500,
  currency: 'BRL',
};

describe('renderDescription', () => {
  it('returns plain text unchanged when no tags are present', () => {
    expect(renderDescription('Monthly rent', base)).toBe('Monthly rent');
  });

  it('replaces [contact_name]', () => {
    expect(renderDescription('Invoice for [contact_name]', base)).toBe('Invoice for João Silva');
  });

  it('replaces [month]', () => {
    expect(renderDescription('[month]', base)).toBe('January 2026');
  });

  it('replaces [instalment] as "N of T" when totalInstalments > 0', () => {
    expect(renderDescription('Parcel [instalment]', base)).toBe('Parcel 3 of 12');
  });

  it('replaces [instalment] as just N when totalInstalments is 0 (unlimited)', () => {
    const ctx = { ...base, totalInstalments: 0 };
    expect(renderDescription('Parcel [instalment]', ctx)).toBe('Parcel 3');
  });

  it('replaces [value] with currency-formatted amount using the contract currency', () => {
    expect(renderDescription('[value]', base)).toMatch(/1,500/);
    expect(renderDescription('[value]', base)).toMatch(/R\$|BRL/);
  });

  it('replaces [value] correctly for GBP', () => {
    const ctx = { ...base, currency: 'GBP', amount: 750.5 };
    const result = renderDescription('[value]', ctx);
    expect(result).toMatch(/£|GBP/);
    expect(result).toMatch(/750/);
  });

  it('replaces [period] as DD/MM/YYYY - DD/MM/YYYY for a monthly cycle', () => {
    expect(renderDescription('[period]', base)).toBe('20/01/2026 - 19/02/2026');
  });

  it('replaces [period] correctly for a quarterly cycle', () => {
    const ctx = { ...base, cycleMonths: 3 };
    expect(renderDescription('[period]', ctx)).toBe('20/01/2026 - 19/04/2026');
  });

  it('replaces [period] correctly when the cycle crosses a year boundary', () => {
    const ctx = { ...base, dueDate: new Date('2025-11-20T00:00:00.000Z'), cycleMonths: 3 };
    expect(renderDescription('[period]', ctx)).toBe('20/11/2025 - 19/02/2026');
  });

  it('replaces all tags at once', () => {
    const tpl = '[instalment] - [contact_name] - [month] - [period] - [value]';
    const result = renderDescription(tpl, base);
    expect(result).toBe('3 of 12 - João Silva - January 2026 - 20/01/2026 - 19/02/2026 - R$1,500.00');
  });

  it('replaces the same tag multiple times', () => {
    expect(renderDescription('[month] ([month])', base)).toBe('January 2026 (January 2026)');
  });
});
