import { Tag } from '../../tags/models/tags.model';
import { ContactResponseDto } from '../../contacts/dtos';
import { TagResponseDto } from '../../tags/dtos';
import { WalletSummaryDto } from '../../wallets/dtos';
import { ContractStatus, ContractType } from '../models/contract.model';

export interface CreateContractDto {
  userId: string;
  name: string;
  contactId: string;
  walletId?: string;
  type: ContractType;
  amount: number;
  currency?: string;
  description: string;
  notes?: string | null;
  tags?: Array<string | Tag>;
  instalments: number;
  cycleMonths: number;
  firstDueDate: Date;
}

export interface UpdateContractDto {
  id: string;
  userId: string;
  name?: string;
  contactId?: string;
  walletId?: string | null;
  amount?: number;
  currency?: string;
  description?: string;
  notes?: string | null;
  tags?: Array<string | Tag>;
  instalments?: number;
  cycleMonths?: number;
  firstDueDate?: Date;
}

export interface ContractQueryDto {
  id: string;
  userId: string;
  remove?: string;
  deleted?: boolean;
}

export interface ListContractsDto {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  filterByStatus?: ContractStatus;
  filterByType?: ContractType;
  filterByContactId?: string;
  filterByContactName?: string;
  filterByCurrency?: string;
  name?: string;
  description?: string;
  search?: string;
  deleted?: boolean;
  includeCompleted?: boolean;
}

export interface GenerateForContractDto {
  id: string;
  userId: string;
}

interface MoneyDto {
  amount: number;
  currency: string;
}

export interface ContractInvoiceSummaryDto {
  id: string;
  status: string;
  dueDate: Date;
  issueDate: Date;
  total: MoneyDto;
  paidAmount: MoneyDto;
  outstanding: MoneyDto;
}

export interface ContractTotalsDto {
  totalInvoiced: MoneyDto;
  totalPaid: MoneyDto;
  totalOutstanding: MoneyDto;
}

export interface ContractResponseDto {
  id: string;
  name: string;
  type: ContractType;
  status: ContractStatus;
  contact: ContactResponseDto;
  walletId: string | null;
  wallet: WalletSummaryDto | null;
  total: { amount: number; currency: string };
  description: string;
  notes: string | null;
  tags: TagResponseDto[];
  instalments: number;
  instalmentsDone: number;
  cycleMonths: number;
  firstDueDate: Date;
  nextDueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  invoices?: ContractInvoiceSummaryDto[];
  totalInvoiced?: MoneyDto;
  totalPaid?: MoneyDto;
  totalOutstanding?: MoneyDto;
}

export { ContactResponseDto, TagResponseDto };
