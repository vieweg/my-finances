import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { apiClient } from "@/api/client";
import { useWallets } from "./useWallets";

vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const mockWallets = [
  { id: "w1", name: "Checking", balance: 1000, currency: "BRL" },
  { id: "w2", name: "Savings", balance: 5000, currency: "BRL" },
];

function page(data: unknown[], page: number, hasNextPage: boolean) {
  return {
    data: { data, pagination: { page, limit: 100, total: 0, totalPages: 0, hasNextPage } },
    error: undefined,
  };
}

describe("useWallets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the list of wallets", async () => {
    (apiClient.GET as any).mockResolvedValue(page(mockWallets, 1, false));

    const { result } = renderHook(() => useWallets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWallets);
  });

  it("fetches every page and concatenates them", async () => {
    (apiClient.GET as any)
      .mockResolvedValueOnce(page([mockWallets[0]], 1, true))
      .mockResolvedValueOnce(page([mockWallets[1]], 2, false));

    const { result } = renderHook(() => useWallets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWallets);
    expect(apiClient.GET).toHaveBeenCalledTimes(2);
  });

  it("sets isError when the API fails", async () => {
    (apiClient.GET as any).mockResolvedValue({ data: undefined, error: { message: "Unauthorized" } });

    const { result } = renderHook(() => useWallets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("returns an empty array when there are no wallets", async () => {
    (apiClient.GET as any).mockResolvedValue(page([], 1, false));

    const { result } = renderHook(() => useWallets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
