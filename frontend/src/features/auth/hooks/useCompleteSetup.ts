import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/auth";

interface SetupBody {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Creates the first account, then logs in with it
export function useCompleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SetupBody) => {
      const { error } = await apiClient.POST("/api/setup", { body });
      if (error) {
        const details = "error" in error ? error.error : undefined;
        throw new Error(details?.join(". ") || error.message || "Failed to create account");
      }
      const { data: session } = await apiClient.POST("/api/sessions", {
        body: { username: body.username, password: body.password },
      });
      if (session?.token) useAuthStore.getState().setToken(session.token);
    },
    onSuccess: () => {
      queryClient.setQueryData(["setup"], { needsSetup: false });
    },
  });
}
