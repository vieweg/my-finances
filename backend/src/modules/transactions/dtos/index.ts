import { PaginatedResponseDto } from '../../../utils/pagination';
import { Tag } from '../../tags/models/tags.model';
import { TagResponseDto } from '../../tags/dtos';
import { WalletSummaryDto } from '../../wallets/dtos';

export interface AddTransactionDto {
  userId: string;
  date: Date;
  total: number;
  currency?: string;
  description: string;
  type: 'income' | 'outcome';
  walletId?: string | null;
  tags?: Array<string | Tag>;
  notes?: string | null;
}

export interface UpdateTransactionDto {
  id: string;
  userId: string;
  date: Date;
  total: number;
  currency?: string;
  description: string;
  type: 'income' | 'outcome';
  walletId?: string | null;
  tags?: Array<string | Tag>;
  notes?: string | null;
}

export interface GetOrDeleteTransactionDto {
  id?: string;
  userId: string;
  remove?: string;
  deleted?: boolean;
}

export interface HistoryTransactionDto {
  id: string;
  userId: string;
  page?: number;
  limit?: number;
}

export interface RestoreTransactionDto {
  id: string;
  versionId: string;
  userId: string;
}

export interface ListTransactionsDto {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  filterByType?: string;
  filterByCurrency?: string;
  filterByDateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  description?: string;
  search?: string;
  filterByTag?: string[];
  filterByTagId?: string[];
  deleted?: boolean;
}

export interface InvoiceSummaryDto {
  id: string;
  type: string;
  status: string;
  total: { amount: number; currency: string };
}

export interface TransactionResponseDto {
  id: string;
  versionId: string;
  version: number;
  date: Date;
  total: {
    amount: number;
    currency: string;
  };
  description: string;
  type: 'income' | 'outcome';
  walletId: string | null;
  wallet: WalletSummaryDto | null;
  invoice: InvoiceSummaryDto | null;
  notes: string | null;
  tags?: Array<TagResponseDto>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface TransactionWithHistoryResponseDto extends TransactionResponseDto {
  history: TransactionResponseDto[];
}

export type HistoryResponseDto = PaginatedResponseDto<TransactionResponseDto>;

export interface TransactionSummaryDto {
  userId: string;
  month: number;
  year: number;
  currency: string;
}

export interface TransactionSummaryResponseDto {
  currency: string;
  month: number;
  year: number;
  lastMonthBalance: number;
  income: number;
  outcome: number;
  balance: number;
  availableBalance: number;
}
