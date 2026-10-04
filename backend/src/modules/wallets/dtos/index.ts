import { PaginatedResponseDto } from '../../../utils/pagination';
export interface CreateWalletDto {
  userId: string;
  name: string;
  currency: string;
}

export interface UpdateWalletDto {
  id: string;
  userId: string;
  name: string;
}

export interface GetOrDeleteWalletDto {
  id: string;
  userId: string;
  remove?: string;
  deleted?: boolean;
}

export interface ListWalletDto {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  currency?: string;
  deleted?: boolean;
}

export interface AdjustWalletDto {
  id: string;
  userId: string;
  amount: number;
  recordedAt?: Date;
}

export interface WalletHistoryDto {
  id: string;
  userId: string;
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export type BalanceSeriesInterval = 'day' | 'week' | 'month';

export interface BalanceSeriesDto {
  userId: string;
  startDate: string;
  endDate: string;
  interval?: BalanceSeriesInterval;
  walletIds?: string[];
  timezone?: string;
  currency?: string;
}

export interface BalanceSeriesResponseDto {
  interval: BalanceSeriesInterval;
  timezone: string;
  buckets: string[];
  series: Array<{
    walletId: string;
    name: string;
    currency: string;
    openingBalance: number;
    balances: number[];
  }>;
  total: number[] | null;
}

export interface SnapshotResponseDto {
  id: string;
  amount: number;
  delta: number;
  source: 'manual' | 'transaction';
  transactionId: string | null;
  recordedAt: Date;
  effectiveAt: Date;
  createdAt: Date;
}

export interface ReorderWalletsDto {
  userId: string;
  ids: string[];
  currency?: string;
}

export interface WalletResponseDto {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface WalletSummaryDto {
  id: string;
  name: string;
  currency: string;
  deletedAt: Date | null;
}

export interface WalletWithHistoryResponseDto extends WalletResponseDto {
  recentSnapshots: SnapshotResponseDto[];
}

export type WalletHistoryResponseDto = PaginatedResponseDto<SnapshotResponseDto>;
