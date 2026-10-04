import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface CreateContactBody {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContactBody) => {
      const { data, error } = await apiClient.POST("/api/contacts", { body });
      if (error) throw new Error(error.message || "Failed to create contact");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
