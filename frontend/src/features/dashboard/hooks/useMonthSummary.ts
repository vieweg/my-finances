import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useMonthSummary(year: number, month: number, currency: string) {
  return useQuery({
    queryKey: ["transactions", "summary", year, month, currency],
    enabled: !!currency,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/transactions/summary", {
        params: {
          query: {
            month: month + 1,
            year,
            currency: currency as never,
          },
        },
      });
      if (error) throw new Error("Failed to load monthly summary");
      return data;
    },
  });
}
