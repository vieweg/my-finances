import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { apiClient } from "@/api/client";
import { useCreateTransaction } from "./useCreateTransaction";

vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const newTransaction = {
  date: "2024-06-01",
  total: 200,
  description: "Freelance payment",
  type: "income" as const,
  currency: "BRL",
};

describe("useCreateTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to the API and returns the created transaction", async () => {
    const created = { id: "abc", ...newTransaction };
    (apiClient.POST as any).mockResolvedValue({ data: created, error: undefined });

    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() });

    result.current.mutate(newTransaction);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(created);
  });

  it("sets isError when the API fails", async () => {
    (apiClient.POST as any).mockResolvedValue({
      data: undefined,
      error: { message: "Validation failed" },
    });

    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() });

    result.current.mutate(newTransaction);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Validation failed");
  });
});
