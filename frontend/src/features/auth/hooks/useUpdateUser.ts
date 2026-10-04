import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface UpdateUserBody {
  name?: string;
  username?: string;
  password?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateUserBody) => {
      const { data, error } = await apiClient.PUT("/api/users/{id}", {
        params: { path: { id: userId } },
        body,
      });
      if (error) throw new Error(error.message || "Erro ao atualizar perfil");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
  });
}
