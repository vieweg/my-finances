import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useSession } from "@/features/auth";

function getUserIdFromToken(): string | null {
  const { token } = useSession();
  if (!token) return null;
  try {
    const sub = JSON.parse(atob(token.split(".")[1]));
    return sub.id ?? null;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const userId = getUserIdFromToken();
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/users/{id}", {
        params: { path: { id: userId! } },
      });
      if (error) throw new Error(error.message || "Erro ao carregar perfil");
      return data!;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
