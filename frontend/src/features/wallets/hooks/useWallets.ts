import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/generated";

type Wallet = components["schemas"]["Wallet"];

// Backend maximum page size; wallets are few, so all pages are fetched up front
const LIMIT = 100;

export function useWallets(options: { deleted?: boolean; currency?: string } = {}) {
  return useQuery({
    queryKey: ["wallets", options],
    queryFn: async () => {
      const wallets: Wallet[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await apiClient.GET("/api/wallets", {
          params: {
            query: {
              page,
              limit: LIMIT,
              sortBy: "position",
              sortOrder: "asc",
              deleted: options.deleted,
              currency: options.currency as never,
            },
          },
        });
        if (error) throw new Error(error.message || "Erro ao carregar carteiras");
        wallets.push(...(data?.data ?? []));
        if (!data?.pagination?.hasNextPage) return wallets;
      }
    },
  });
}
