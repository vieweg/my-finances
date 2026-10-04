import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRestoreTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.PATCH("/api/tags/{id}/restore", {
        params: { path: { id } },
      });
      if (error) throw new Error(error.message || "Failed to restore tag");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
