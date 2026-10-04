import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type TagEntry = string | { id?: string; name?: string };

interface AddPaymentBody {
  invoiceId: string;
  date: string;
  total: number;
  description: string;
  currency?: string;
  walletId?: string | null;
  tags?: TagEntry[];
}

export function useAddInvoicePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, ...body }: AddPaymentBody) => {
      const { data, error } = await apiClient.POST(
        "/api/invoices/{id}/transactions",
        {
          params: { path: { id: invoiceId } },
          body: body as never,
        },
      );
      if (error) throw new Error(error.message || "Failed to add payment");
      return data!;
    },
    onSuccess: (_data, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
