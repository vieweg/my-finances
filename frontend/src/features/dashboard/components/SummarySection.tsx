import { formatCurrency, formatDate } from "@/lib/format";
import { useMonthSummary } from "../hooks/useMonthSummary";
import { Calendar } from "lucide-react";

interface Props {
  year: number;
  month: number; // 0-indexed
  globalCurrency: string | null;
  availableCurrencies: string[];
}

function SummaryRow({
  year,
  month,
  currency,
}: {
  year: number;
  month: number;
  currency: string;
}) {
  const { data, isLoading } = useMonthSummary(year, month, currency);

  const balance = data?.balance;
  const balanceColor =
    balance === undefined
      ? "text-gray-900"
      : balance >= 0
        ? "text-green-700"
        : "text-red-700";
  const availableBalance = data?.availableBalance;
  const availableBalanceColor =
    availableBalance === undefined
      ? "text-gray-900"
      : availableBalance >= 0
        ? "text-green-700"
        : "text-red-700";

  return (
    <tr className="text-sm">
      {isLoading ? (
        <td colSpan={6} className="h-6 mt-1 bg-gray-200 animate-pulse" />
      ) : (
        <>
          <td className="px-2">
            <p className="font-semibold text-gray-400">{currency}</p>
          </td>
          <td className="text-right pr-2">
            <p>
              {data?.lastMonthBalance
                ? formatCurrency(data.lastMonthBalance, currency)
                : "—"}
            </p>
          </td>
          <td className="hidden sm:table-cell text-right pr-2">
            <p>
              {data?.income ? formatCurrency(data.income, currency) : "—"}
            </p>
          </td>
          <td className="hidden sm:table-cell text-right pr-2">
            <p>
              {data?.outcome ? formatCurrency(data.outcome, currency) : "—"}
            </p>
          </td>
          <td className="text-right pr-2">
            <p className={balanceColor}>
              {data?.balance ? formatCurrency(data.balance, currency) : "—"}
            </p>
          </td>
          <td className="text-right pr-2">
            <p className={availableBalanceColor}>
              {data?.availableBalance
                ? formatCurrency(data.availableBalance, currency)
                : "—"}
            </p>
          </td>
        </>
      )}
    </tr>
  );
}

export function SummarySection({
  year,
  month,
  globalCurrency,
  availableCurrencies,
}: Props) {
  const currencies = globalCurrency
    ? availableCurrencies.filter((c) => c === globalCurrency)
    : availableCurrencies;

  if (!currencies.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-400 text-center">
        No currencies configured. Add a wallet to get started.
      </div>
    );
  }

  return (
    <div className="flex-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center px-4 py-3 border-b border-gray-100 gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
        <Calendar size={15} className="text-gray-400" />
        <span>{formatDate(`${year}-${month + 1}-1`, "MMM/yyyy")}</span>
      </div>
      <div className="p-2">
        <table className="w-full">
          <thead className="text-xs font-medium text-gray-500 uppercase tracking-wide h-6 align-text-top">
            <tr>
              <th className="text-left"></th>
              <th className="text-right pr-2">Last Month</th>
              <th className="hidden sm:table-cell text-right pr-2">Income</th>
              <th className="hidden sm:table-cell text-right pr-2">Outcome</th>
              <th className="text-right pr-2">Balance</th>
              <th className="text-right pr-2">Available</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((currency) => (
              <SummaryRow
                key={currency}
                year={year}
                month={month}
                currency={currency}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
