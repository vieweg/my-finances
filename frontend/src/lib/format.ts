import { format } from "date-fns";

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    value,
  );
}

export function formatDate(
  date: string | Date,
  dateFormat = "dd/MM/yyyy",
): string {
  return format(new Date(date), dateFormat);
}

/** Today's date (YYYY-MM-DD) in the user's time zone, for date inputs. */
export function todayLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Date input value (YYYY-MM-DD) → timestamp for the API, at local noon.
 * A bare date or UTC midnight would land on the previous day in time zones behind UTC.
 */
export function dateInputToISO(date: string): string {
  return new Date(date + "T12:00:00").toISOString();
}

/** "40 of 100 invoices" while more pages exist, otherwise "100 invoices". */
export function formatListCount(
  loaded: number,
  total: number | undefined,
  noun: string,
): string {
  const count = total ?? loaded;
  const label = `${noun}${count !== 1 ? "s" : ""}`;
  return total != null && loaded < total
    ? `${loaded} of ${total} ${label}`
    : `${count} ${label}`;
}
