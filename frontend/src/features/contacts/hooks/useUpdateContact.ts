import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface UpdateContactBody {
  id: string;
  name?: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateContactBody) => {
      const { data, error } = await apiClient.PUT("/api/contacts/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw new Error(error.message || "Failed to update contact");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
