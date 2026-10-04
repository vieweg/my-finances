import { PaginatedResponseDto } from '../../../utils/pagination';
export interface AddTagDto {
  userId: string;
  name: string;
}

export interface UpdateTagDto {
  id: string;
  userId: string;
  name: string;
}

export interface GetOrDeleteTagDto {
  id: string;
  userId: string;
  deleted?: boolean;
}

export interface ListTagDto {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  deleted?: boolean;
}

export interface TagResponseDto {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type TagListResponseDto = PaginatedResponseDto<TagResponseDto>;

export interface ListTagDuplicatesDto {
  userId: string;
}

export interface MergeTagsDto {
  userId: string;
  targetId: string;
  sourceIds: string[];
}

export interface TagUsageDto {
  transactions: number;
  invoices: number;
  contracts: number;
}

export interface TagWithUsageResponseDto extends TagResponseDto {
  usage: TagUsageDto;
}

export interface TagDuplicateGroupDto {
  key: string;
  tags: TagWithUsageResponseDto[];
}

export interface MergeTagsResponseDto {
  tag: TagWithUsageResponseDto;
  mergedIds: string[];
}
