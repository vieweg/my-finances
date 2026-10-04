import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useCurrencyStore } from "@/store/currency";

export function useReorderWallets() {
  const queryClient = useQueryClient();
  const { currency } = useCurrencyStore();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await apiClient.PATCH("/api/wallets/reorder", {
        body: { ids, ...(currency ? { currency: currency as never } : {}) },
      });
      if (error) throw new Error(error.message || "Failed to reorder wallets");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
