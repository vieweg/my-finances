import { format, subMonths } from "date-fns";
import { todayLocal } from "@/lib/format";

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Balance charts open on the last month. */
export function defaultBalanceRange(): DateRange {
  return {
    startDate: format(subMonths(new Date(), 1), "yyyy-MM-dd"),
    endDate: todayLocal(),
  };
}
