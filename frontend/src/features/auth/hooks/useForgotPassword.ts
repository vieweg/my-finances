import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await apiClient.POST("/api/users/forgot", {
        body: { email },
      });
      if (error) throw new Error(error.message || "Failed to send reset email");
    },
  });
}
