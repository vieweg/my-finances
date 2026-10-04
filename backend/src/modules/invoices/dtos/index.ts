import { Tag } from '../../tags/models/tags.model';
import { ContactResponseDto } from '../../contacts/dtos';
import { TagResponseDto } from '../../tags/dtos';
import { WalletSummaryDto } from '../../wallets/dtos';
import { InvoiceHistoryEvent } from '../models/invoice.model';

export interface CreateInvoiceDto {
  userId: string;
  contactId: string;
  walletId?: string;
  type: 'payable' | 'receivable';
  amount: number;
  currency?: string;
  issueDate: Date;
  dueDate: Date;
  description: string;
  notes?: string | null;
  tags?: Array<string | Tag>;
}

export interface UpdateInvoiceDto {
  id: string;
  userId: string;
  contactId?: string;
  walletId?: string | null;
  amount?: number;
  currency?: string;
  issueDate?: Date;
  dueDate?: Date;
  description?: string | null;
  notes?: string | null;
  tags?: Array<string | Tag>;
}

export interface AddInvoiceTransactionDto {
  invoiceId: string;
  userId: string;
  date: Date;
  total: number;
  currency?: string;
  description: string;
  walletId?: string | null;
  notes?: string | null;
  tags?: Array<string | Tag>;
}

export interface MarkPaidDto {
  id: string;
  userId: string;
}

export interface InvoiceQueryDto {
  id: string;
  userId: string;
  remove?: string;
  deleted?: boolean;
  reason?: string;
}

export interface ListInvoicesDto {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  filterByType?: string;
  filterByStatus?: string | string[];
  filterByIsOverdue?: boolean;
  filterByCurrency?: string;
  filterByContactId?: string;
  filterByContactName?: string;
  search?: string;
  filterByDateRange?: { startDate?: Date; endDate?: Date };
  description?: string;
  filterByTag?: string[];
  filterByTagId?: string[];
  deleted?: boolean;
  contractId?: string;
  forecast?: boolean;
}

export interface TransactionSummaryDto {
  id: string;
  versionId: string;
  date: Date;
  type: string;
  total: { amount: number; currency: string };
  description: string;
  tags?: Array<TagResponseDto>;
  walletId: string | null;
  wallet: WalletSummaryDto | null;
  notes: string | null;
}

export interface InvoiceResponseDto {
  id: string;
  type: string;
  status: string;
  isOverdue: boolean;
  contact: ContactResponseDto;
  walletId: string | null;
  wallet: WalletSummaryDto | null;
  contractId: string | null;
  total: { amount: number; currency: string };
  paidAmount: { amount: number; currency: string };
  issueDate: Date;
  dueDate: Date;
  description: string | null;
  notes: string | null;
  tags: TagResponseDto[];
  history: InvoiceHistoryEvent[];
  transactions?: TransactionSummaryDto[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  projected?: boolean;
}

export interface ProjectedInvoiceDto {
  projected: true;
  contractId: string;
  contact: ContactResponseDto;
  walletId: string | null;
  wallet: WalletSummaryDto | null;
  type: 'payable' | 'receivable';
  total: { amount: number; currency: string };
  paidAmount: { amount: number; currency: string };
  status: 'projected';
  isOverdue: false;
  dueDate: Date;
  issueDate: null;
  description: string | null;
  tags: TagResponseDto[];
  history: [];
}

export { ContactResponseDto, TagResponseDto };
