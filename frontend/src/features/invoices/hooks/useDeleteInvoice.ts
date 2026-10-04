import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

// Backend limit for cancel/restore reasons
const REASON_MAX_LENGTH = 500;

/**
 * Asks to confirm cancelling an invoice, with an optional reason.
 * Returns null when the user backs out, otherwise the (possibly empty) reason.
 */
export function promptCancelReason(contactName?: string): string | null {
  const reason = prompt(
    `Cancel invoice for "${contactName ?? "—"}"?\n\nReason (optional):`,
    "",
  );
  return reason === null ? null : reason.trim().slice(0, REASON_MAX_LENGTH);
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await apiClient.DELETE("/api/invoices/{id}", {
        params: { path: { id } },
        body: reason ? { reason } : undefined,
      });
      if (error) throw new Error(error.message || "Failed to delete invoice");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
