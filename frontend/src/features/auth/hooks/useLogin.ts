import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const { data, error } = await apiClient.POST("/api/sessions", {
        body: credentials,
      });
      if (error) throw new Error(error.message || "Login failed");
      if (!data) throw new Error("No response from server");
      return data;
    },
    onSuccess: (data) => {
      if (data.token) useAuthStore.getState().setToken(data.token);
    },
  });
}
