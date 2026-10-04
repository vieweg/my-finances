import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

// needsSetup is true until the first account has been created
export function useSetupStatus() {
  return useQuery({
    queryKey: ["setup"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/setup");
      if (error) throw new Error("Failed to load setup status");
      return data!;
    },
  });
}
