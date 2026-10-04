import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useGenerateContractInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.POST("/api/contracts/{id}/generate", {
        params: { path: { id } },
      });
      if (error) throw new Error(error.message || "Failed to generate invoice");
      return data!;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
