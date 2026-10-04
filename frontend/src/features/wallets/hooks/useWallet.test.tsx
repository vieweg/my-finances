import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { apiClient } from "@/api/client";
import { useWallet } from "./useWallet";

vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const mockWallet = { id: "w1", name: "Checking", balance: 1000, currency: "BRL" };

describe("useWallet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a single wallet by id", async () => {
    (apiClient.GET as any).mockResolvedValue({ data: mockWallet, error: undefined });

    const { result } = renderHook(() => useWallet("w1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWallet);
  });

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => useWallet(""), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it("sets isError when the API fails", async () => {
    (apiClient.GET as any).mockResolvedValue({ data: undefined, error: { message: "Not found" } });

    const { result } = renderHook(() => useWallet("missing"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
