export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

// Shape of every paginated list response
export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationDto;
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResponseDto<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    },
  };
}
