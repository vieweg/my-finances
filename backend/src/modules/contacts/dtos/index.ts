import { PaginatedResponseDto } from '../../../utils/pagination';
export interface CreateContactDto {
  userId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateContactDto {
  id: string;
  userId: string;
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface ContactQueryDto {
  id: string;
  userId: string;
  remove?: string;
  deleted?: boolean;
}

export interface ListContactsDto {
  userId: string;
  deleted?: boolean;
  name?: string;
  email?: string;
  sortBy?: 'name' | 'email' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export type ContactsListResponseDto = PaginatedResponseDto<ContactResponseDto>;

export interface ContactResponseDto {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
