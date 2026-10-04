import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { apiClient } from "@/api/client";
import { useTransactions } from "./useTransactions";

vi.mock("@/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const mockTransactions = [
  { id: "1", date: "2024-01-01", total: 100, description: "Salary", type: "income", currency: "BRL" },
  { id: "2", date: "2024-01-02", total: 50, description: "Groceries", type: "outcome", currency: "BRL" },
];

function response(data: unknown[], hasNextPage: boolean) {
  return {
    data: { data, pagination: { page: 1, limit: 20, total: data.length, totalPages: 1, hasNextPage } },
    error: undefined,
  };
}

describe("useTransactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns transactions from the API", async () => {
    (apiClient.GET as any).mockResolvedValue(response(mockTransactions, false));

    const { result } = renderHook(() => useTransactions({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].data).toEqual(mockTransactions);
  });

  it("sets isError when the API fails", async () => {
    (apiClient.GET as any).mockResolvedValue({ data: undefined, error: { message: "Server error" } });

    const { result } = renderHook(() => useTransactions({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("returns an empty first page when the API returns no items", async () => {
    (apiClient.GET as any).mockResolvedValue(response([], false));

    const { result } = renderHook(() => useTransactions({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].data).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("indicates a next page when the backend reports hasNextPage", async () => {
    (apiClient.GET as any).mockResolvedValue(response(mockTransactions, true));

    const { result } = renderHook(() => useTransactions({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});
