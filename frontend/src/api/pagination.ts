import type { components } from "./generated";

type Pagination = components["schemas"]["Pagination"];

/** `getNextPageParam` for useInfiniteQuery over the backend's `{ data, pagination }` list responses. */
export function getNextPageFromPagination(lastPage: {
  pagination?: Pagination;
}): number | undefined {
  const { page, hasNextPage } = lastPage.pagination ?? {};
  return hasNextPage && page ? page + 1 : undefined;
}
