import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRestoreContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.PATCH("/api/contacts/{id}/restore", {
        params: { path: { id } },
      });
      if (error) throw new Error(error.message || "Failed to restore contact");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
