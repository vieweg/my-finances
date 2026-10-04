import Joi, { ValidationResult } from 'joi';
import { PAGINATION_TRANSACTIONS, VALID_CURRENCIES, NOTES_MAX_LENGTH } from '../../../constants';

import {
  AddTransactionDto,
  UpdateTransactionDto,
  GetOrDeleteTransactionDto,
  ListTransactionsDto,
  HistoryTransactionDto,
  RestoreTransactionDto,
  TransactionSummaryDto,
} from '../dtos';

export class ValidateTransaction {
  static create(input: AddTransactionDto): ValidationResult<AddTransactionDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      date: Joi.date().required(),
      total: Joi.number().required(),
      walletId: Joi.string().uuid().optional().allow(null),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).required().messages({ 'any.only': '"currency" must be a valid ISO 4217 currency code' }),
      }),
      description: Joi.string().trim().required(),
      type: Joi.string().valid('income', 'outcome').required(),
      notes: Joi.string().trim().max(NOTES_MAX_LENGTH).allow(null, '').optional(),
      tags: Joi.array()
        .items(
          Joi.string().min(3).max(50).trim(),
          Joi.object({
            id: Joi.string().uuid().required(),
            name: Joi.string().required(),
          }),
        )
        .optional(),
    }).options({ abortEarly: false });

    return schema.validate(input);
  }

  static update(input: UpdateTransactionDto): ValidationResult<UpdateTransactionDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      date: Joi.date().required(),
      total: Joi.number().required(),
      walletId: Joi.string().uuid().optional().allow(null),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).required().messages({ 'any.only': '"currency" must be a valid ISO 4217 currency code' }),
      }),
      description: Joi.string().trim().required(),
      type: Joi.string().valid('income', 'outcome').required(),
      notes: Joi.string().trim().max(NOTES_MAX_LENGTH).allow(null, '').optional(),
      tags: Joi.array()
        .items(
          Joi.string().min(3).max(50).trim(),
          Joi.object({ id: Joi.string().uuid().required(), name: Joi.string().required() }),
        )
        .optional(),
    }).options({ abortEarly: false });

    return schema.validate(input);
  }

  static list(input: ListTransactionsDto): ValidationResult<ListTransactionsDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_TRANSACTIONS.MAX_LIMIT).optional(),
      sortBy: Joi.string()
        .valid(...PAGINATION_TRANSACTIONS.SORT_BY)
        .optional(),
      sortOrder: Joi.string()
        .valid(...PAGINATION_TRANSACTIONS.SORT_ORDER)
        .optional(),
      filterByType: Joi.string().valid('income', 'outcome').optional(),
      filterByCurrency: Joi.string()
        .valid(...VALID_CURRENCIES)
        .optional()
        .messages({ 'any.only': '"filterByCurrency" must be a valid ISO 4217 currency code' }),
      filterByDateRange: Joi.object({
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
      }).optional(),
      description: Joi.string().trim().min(1).max(255).optional(),
      search: Joi.string().trim().min(1).max(255).optional(),
      filterByTag: Joi.array().items(Joi.string().trim().min(1).max(50)).min(1).optional(),
      filterByTagId: Joi.array().items(Joi.string().uuid()).min(1).optional(),
      deleted: Joi.boolean().optional(),
    }).options({ abortEarly: false });

    return schema.validate(input);
  }

  static getOrRemove(
    input: GetOrDeleteTransactionDto,
  ): ValidationResult<GetOrDeleteTransactionDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      remove: Joi.string().valid('remove'),
      deleted: Joi.boolean().optional(),
    });

    return schema.validate(input);
  }

  static history(input: HistoryTransactionDto): ValidationResult<HistoryTransactionDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_TRANSACTIONS.MAX_LIMIT).optional(),
    }).options({ abortEarly: false });

    return schema.validate(input);
  }

  static restore(input: RestoreTransactionDto): ValidationResult<RestoreTransactionDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      versionId: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
    });

    return schema.validate(input);
  }

  static summary(input: TransactionSummaryDto): ValidationResult<TransactionSummaryDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      month: Joi.number().integer().min(1).max(12).required(),
      year: Joi.number().integer().min(2000).max(2100).required(),
      currency: Joi.string().valid(...VALID_CURRENCIES).required().messages({
        'any.only': '"currency" must be a valid ISO 4217 currency code',
        'any.required': '"currency" is required',
      }),
    }).options({ abortEarly: false });

    return schema.validate(input);
  }
}
