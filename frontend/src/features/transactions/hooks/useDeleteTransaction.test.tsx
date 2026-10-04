import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { apiClient } from "@/api/client";
import { useDeleteTransaction } from "./useDeleteTransaction";

vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

describe("useDeleteTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls DELETE and succeeds", async () => {
    (apiClient.DELETE as any).mockResolvedValue({ error: undefined });

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() });

    result.current.mutate("tx-123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("sets isError when the API fails", async () => {
    (apiClient.DELETE as any).mockResolvedValue({ error: { message: "Not found" } });

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() });

    result.current.mutate("missing-id");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Not found");
  });
});
