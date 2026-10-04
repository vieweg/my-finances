import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; currency: string }) => {
      const { data, error } = await apiClient.POST("/api/wallets", { body: body as never });
      if (error) throw new Error(error.message || "Failed to create wallet");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
