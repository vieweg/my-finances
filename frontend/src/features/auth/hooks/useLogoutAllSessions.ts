import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useCurrencyStore } from "@/store/currency";

export function useLogoutAllSessions() {
  const clearToken = useAuthStore((state) => state.clearToken);
  const clearCurrencies = useCurrencyStore((state) => state.clearCurrencies);

  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE("/api/sessions/all");
      if (error)
        throw new Error(error.message || "Failed to sign out all sessions");
    },
    onSettled: () => {
      clearToken();
      clearCurrencies();
    },
  });
}
