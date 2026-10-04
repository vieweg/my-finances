import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type TagEntry = string | { id?: string; name: string };

export type TransactionBody = {
  date: string;
  total: number;
  walletId?: string | null;
  currency?: string;
  description: string;
  notes?: string | null;
  type: "income" | "outcome";
  tags?: TagEntry[];
};

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TransactionBody) => {
      const apiBody = {
        ...body,
        tags: body.tags?.map((t) =>
          typeof t === "string"
            ? t
            : t.id
              ? { id: t.id, name: t.name }
              : t.name,
        ) as (string | { id: string; name: string })[],
      };
      const { data, error } = await apiClient.POST("/api/transactions", {
        body: apiBody as never,
      });
      if (error) throw new Error(error.message || "Erro ao criar transação");
      return data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      if (data.walletId) {
        queryClient.invalidateQueries({ queryKey: ["wallets"] });
        queryClient.invalidateQueries({ queryKey: ["wallets", data.walletId] });
      }
    },
  });
}
