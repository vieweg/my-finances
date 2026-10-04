import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type TagEntry = string | { id?: string; name?: string };

interface UpdateContractBody {
  id: string;
  name?: string;
  contactId?: string;
  walletId?: string | null;
  amount?: number;
  currency?: string;
  instalments?: number;
  cycleMonths?: number;
  firstDueDate?: string;
  description?: string | null;
  notes?: string | null;
  tags?: TagEntry[];
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateContractBody) => {
      const { data, error } = await apiClient.PUT("/api/contracts/{id}", {
        params: { path: { id } },
        body: body as never,
      });
      if (error) throw new Error(error.message || "Failed to update contract");
      return data!;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", id] });
    },
  });
}
