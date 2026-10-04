import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface ResetPasswordBody {
  token: string;
  password: string;
  confirmPassword: string;
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (body: ResetPasswordBody) => {
      const { data, error } = await apiClient.PATCH("/api/users/password", {
        body,
      });
      if (error) throw new Error(error.message || "Failed to reset password");
      return data!;
    },
  });
}
