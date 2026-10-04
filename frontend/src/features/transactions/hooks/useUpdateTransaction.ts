import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { TransactionBody } from "./useCreateTransaction";

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: TransactionBody }) => {
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
      const { data, error } = await apiClient.PUT("/api/transactions/{id}", {
        params: { path: { id } },
        body: apiBody as never,
      });
      if (error)
        throw new Error(error.message || "Erro ao atualizar transação");
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
