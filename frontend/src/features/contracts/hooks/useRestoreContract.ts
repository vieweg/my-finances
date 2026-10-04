import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRestoreContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.PATCH("/api/contracts/{id}/restore", {
        params: { path: { id } },
      });
      if (error) throw new Error(error.message || "Failed to restore contract");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
