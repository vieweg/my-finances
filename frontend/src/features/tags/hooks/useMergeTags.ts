import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useMergeTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { targetId: string; sourceIds: string[] }) => {
      const { data, error } = await apiClient.POST("/api/tags/merge", { body });
      if (error) throw new Error(error.message || "Failed to merge tags");
      return data!;
    },
    onSuccess: () => {
      // Merging relinks tags on every resource that uses them
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
