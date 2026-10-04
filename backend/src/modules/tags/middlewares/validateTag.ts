import Joi, { ValidationResult } from 'joi';
import { PAGINATION_TAGS } from '../../../constants';

import { AddTagDto, UpdateTagDto, GetOrDeleteTagDto, ListTagDto, ListTagDuplicatesDto, MergeTagsDto } from '../dtos';

export class ValidateTag {
  static create(input: AddTagDto): ValidationResult<AddTagDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      name: Joi.string().min(3).max(50).trim().required(),
    }).options({
      abortEarly: false,
    });

    return schema.validate(input);
  }

  static update(input: UpdateTagDto): ValidationResult<UpdateTagDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      name: Joi.string().min(3).max(50).trim().required(),
    }).options({
      abortEarly: false,
    });
    return schema.validate(input);
  }

  static getOrRemove(input: GetOrDeleteTagDto): ValidationResult<GetOrDeleteTagDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      deleted: Joi.boolean().optional(),
    });

    return schema.validate(input);
  }

  static list(input: ListTagDto): ValidationResult<ListTagDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_TAGS.MAX_LIMIT).optional(),
      sortBy: Joi.string()
        .valid(...PAGINATION_TAGS.SORT_BY)
        .optional(),
      sortOrder: Joi.string()
        .valid(...PAGINATION_TAGS.SORT_ORDER)
        .optional(),
      search: Joi.string().trim().min(1).max(50).optional(),
      deleted: Joi.boolean().optional(),
    }).options({
      abortEarly: false,
    });

    return schema.validate(input);
  }

  static duplicates(input: ListTagDuplicatesDto): ValidationResult<ListTagDuplicatesDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
    });

    return schema.validate(input);
  }

  static merge(input: MergeTagsDto): ValidationResult<MergeTagsDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      targetId: Joi.string().uuid().required(),
      sourceIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).unique().required(),
    }).options({
      abortEarly: false,
    });

    return schema.validate(input);
  }
}
