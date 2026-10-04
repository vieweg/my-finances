import createClient from "openapi-fetch";
import type { paths } from "./generated";
import { useCurrencyStore } from "@/store/currency";
import { useAuthStore } from "@/store/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const apiClient = createClient<paths>({
  baseUrl: BASE_URL,
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

function isExpiredOrExpiringSoon(token: string): boolean {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    return !exp || Date.now() / 1000 >= exp - 30;
  } catch {
    return true;
  }
}

async function doRefresh(): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/api/sessions/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.token) {
    useAuthStore.getState().setToken(data.token);
    return data.token;
  }
  return null;
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function redirectToLogin() {
  useAuthStore.getState().clearToken();
  window.location.href = "/login";
}

apiClient.use({
  async onRequest({ request }) {
    const isSessionsEndpoint = request.url.includes("/api/sessions");
    let token = useAuthStore.getState().token;

    if (token && !isSessionsEndpoint && isExpiredOrExpiringSoon(token)) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        redirectToLogin();
        return request;
      }
      token = newToken;
    }

    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }

    const currency = useCurrencyStore.getState().currency;
    if (currency) {
      request.headers.set("X-Currency", currency);
    }

    return request;
  },

  async onResponse({ response, request }) {
    if (response.status !== 401) return response;
    if (request.url.includes("/api/sessions")) return response;

    redirectToLogin();
    return response;
  },
});
