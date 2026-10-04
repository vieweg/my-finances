import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type TagEntry = string | { id?: string; name?: string };

interface CreateInvoiceBody {
  contactId: string;
  type: "payable" | "receivable";
  amount: number;
  currency?: string;
  issueDate: string;
  dueDate: string;
  walletId?: string;
  description?: string;
  notes?: string | null;
  tags?: TagEntry[];
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInvoiceBody) => {
      const { data, error } = await apiClient.POST("/api/invoices", {
        body: body as never,
      });
      if (error) throw new Error(error.message || "Failed to create invoice");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
