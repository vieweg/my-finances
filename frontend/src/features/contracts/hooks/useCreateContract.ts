import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

type TagEntry = string | { id?: string; name?: string };

interface CreateContractBody {
  name: string;
  contactId: string;
  type: "payable" | "receivable";
  amount: number;
  currency?: string;
  walletId?: string;
  instalments: number;
  cycleMonths: number;
  firstDueDate: string;
  description?: string | null;
  notes?: string | null;
  tags?: TagEntry[];
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContractBody) => {
      const { data, error } = await apiClient.POST("/api/contracts", {
        body: body as never,
      });
      if (error) throw new Error(error.message || "Failed to create contract");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
