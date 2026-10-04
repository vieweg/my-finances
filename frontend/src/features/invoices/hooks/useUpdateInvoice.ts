import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type TagEntry = string | { id?: string; name?: string };

interface UpdateInvoiceBody {
  id: string;
  contactId?: string;
  walletId?: string | null;
  amount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  description?: string | null;
  notes?: string | null;
  tags?: TagEntry[];
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateInvoiceBody) => {
      const { data, error } = await apiClient.PUT("/api/invoices/{id}", {
        params: { path: { id } },
        body: body as never,
      });
      if (error) throw new Error(error.message || "Failed to update invoice");
      return data!;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}
