import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await apiClient.PUT("/api/tags/{id}", {
        params: { path: { id } },
        body: { name },
      });
      if (error) throw new Error(error.message || "Erro ao renomear tag");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
