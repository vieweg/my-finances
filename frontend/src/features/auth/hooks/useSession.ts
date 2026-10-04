import { useCallback } from "react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useCurrencyStore } from "@/store/currency";

export function useSession() {
  const token = useAuthStore((state) => state.token);
  const clearToken = useAuthStore((state) => state.clearToken);
  const clearCurrencies = useCurrencyStore((state) => state.clearCurrencies);
  const isAuthenticated = !!token;

  const logout = useCallback(async () => {
    try {
      await apiClient.DELETE("/api/sessions");
    } finally {
      clearToken();
      clearCurrencies();
    }
  }, [clearToken]);

  return { isAuthenticated, token, logout };
}
