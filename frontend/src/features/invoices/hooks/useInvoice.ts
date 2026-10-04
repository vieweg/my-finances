import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/invoices/{id}", {
        // deleted: true so soft-deleted entries can still be viewed and restored
        params: { path: { id }, query: { deleted: true } },
      });
      if (error) throw new Error(error.message || "Failed to load invoice");
      return data!;
    },
    enabled: !!id,
  });
}
