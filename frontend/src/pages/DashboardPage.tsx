import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useWallets } from "@/features/wallets";
import { useCurrencyStore } from "@/store/currency";
import { apiClient } from "@/api/client";
import {
  MonthNavigator,
  SummarySection,
  WalletsSummaryPanel,
  DashboardTransactionsSection,
  DashboardInvoicesSection,
} from "@/features/dashboard";

function getMonthDateRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = month + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getDate();
  return {
    startDate: `${year}-${pad(m)}-01T00:00:00.000Z`,
    endDate: `${year}-${pad(m)}-${pad(lastDay)}T23:59:59.999Z`,
  };
}

export default function DashboardPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const { startDate, endDate } = useMemo(
    () => getMonthDateRange(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const { currency: globalCurrency, availableCurrencies } = useCurrencyStore();
  const { data: wallets = [], isLoading: walletsLoading } = useWallets({
    currency: globalCurrency ?? undefined,
  });

  const summaryQueries = useQueries({
    queries: (globalCurrency ? [globalCurrency] : availableCurrencies).map(
      (currency) => ({
        queryKey: ["transactions", "summary", selectedYear, selectedMonth, currency],
        enabled: !!currency,
        queryFn: async () => {
          const { data, error } = await apiClient.GET(
            "/api/transactions/summary",
            {
              params: {
                query: {
                  month: selectedMonth + 1,
                  year: selectedYear,
                  currency: currency as never,
                },
              },
            },
          );
          if (error) throw new Error("Failed to load monthly summary");
          return data;
        },
      }),
    ),
  });

  const availableBalanceByCurrency = useMemo(() => {
    const currencies = globalCurrency ? [globalCurrency] : availableCurrencies;
    return currencies.reduce<Record<string, number>>((acc, cur, i) => {
      const available = summaryQueries[i]?.data?.availableBalance;
      if (available !== undefined) acc[cur] = available;
      return acc;
    }, {});
  }, [summaryQueries, globalCurrency, availableCurrencies]);

  function handleMonthChange(year: number, month: number) {
    setSelectedYear(year);
    setSelectedMonth(month);
  }

  return (
    <div className="space-y-4">
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={handleMonthChange}
      />

      <div className="flex gap-4 flex-wrap">
        <SummarySection
          year={selectedYear}
          month={selectedMonth}
          globalCurrency={globalCurrency}
          availableCurrencies={availableCurrencies}
        />

        <WalletsSummaryPanel
          wallets={wallets}
          globalCurrency={globalCurrency}
          isLoading={walletsLoading}
          availableBalanceByCurrency={availableBalanceByCurrency}
        />
      </div>

      <DashboardTransactionsSection startDate={startDate} endDate={endDate} />

      <DashboardInvoicesSection startDate={startDate} endDate={endDate} />
    </div>
  );
}
