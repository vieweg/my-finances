import Joi, { ValidationResult } from 'joi';
import { PAGINATION_WALLETS, VALID_CURRENCIES } from '../../../constants';
import { isValidTimeZone, parseCalendarDate } from '../../../utils/timezone';
import {
  CreateWalletDto,
  UpdateWalletDto,
  GetOrDeleteWalletDto,
  ListWalletDto,
  AdjustWalletDto,
  WalletHistoryDto,
  ReorderWalletsDto,
  BalanceSeriesDto,
} from '../dtos';

const calendarDate = Joi.string()
  .custom((value, helpers) => (parseCalendarDate(value) ? value : helpers.error('any.invalid')))
  .messages({ 'any.invalid': '{{#label}} must be a date formatted as YYYY-MM-DD' });

export class ValidateWallet {
  static create(input: CreateWalletDto): ValidationResult<CreateWalletDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().min(1).max(100).required(),
      currency: Joi.string()
        .valid(...VALID_CURRENCIES)
        .required()
        .messages({ 'any.only': '"currency" must be a valid ISO 4217 currency code' }),
    })
      .options({ abortEarly: false })
      .validate(input);
  }

  static update(input: UpdateWalletDto): ValidationResult<UpdateWalletDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().min(1).max(100).required(),
    })
      .options({ abortEarly: false })
      .validate(input);
  }

  static getOrDelete(input: GetOrDeleteWalletDto): ValidationResult<GetOrDeleteWalletDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      remove: Joi.string().optional(),
      deleted: Joi.boolean().optional(),
    }).validate(input);
  }

  static list(input: ListWalletDto): ValidationResult<ListWalletDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_WALLETS.MAX_LIMIT).optional(),
      sortBy: Joi.string()
        .valid(...PAGINATION_WALLETS.SORT_BY)
        .optional(),
      sortOrder: Joi.string()
        .valid(...PAGINATION_WALLETS.SORT_ORDER)
        .optional(),
      currency: Joi.string()
        .valid(...VALID_CURRENCIES)
        .optional()
        .messages({ 'any.only': '"currency" must be a valid ISO 4217 currency code' }),
      deleted: Joi.boolean().optional(),
    })
      .options({ abortEarly: false })
      .validate(input);
  }

  static adjust(input: AdjustWalletDto): ValidationResult<AdjustWalletDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      amount: Joi.number().required(),
      recordedAt: Joi.date().optional(),
    })
      .options({ abortEarly: false })
      .validate(input);
  }

  static reorder(input: ReorderWalletsDto): ValidationResult<ReorderWalletsDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      currency: Joi.string()
        .valid(...VALID_CURRENCIES)
        .optional()
        .messages({ 'any.only': '"currency" must be a valid ISO 4217 currency code' }),
    }).validate(input);
  }

  static balanceSeries(input: BalanceSeriesDto): ValidationResult<BalanceSeriesDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      startDate: calendarDate.required(),
      endDate: calendarDate.required(),
      interval: Joi.string().valid('day', 'week', 'month').optional(),
      walletIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
      timezone: Joi.string()
        .custom((value, helpers) => (isValidTimeZone(value) ? value : helpers.error('any.invalid')))
        .messages({ 'any.invalid': '"timezone" must be an IANA time zone, e.g. America/Sao_Paulo' })
        .optional(),
      currency: Joi.string().valid(...VALID_CURRENCIES).optional(),
    })
      .options({ abortEarly: false })
      .validate(input);
  }

  static history(input: WalletHistoryDto): ValidationResult<WalletHistoryDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_WALLETS.MAX_LIMIT).optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().min(Joi.ref('startDate')).optional(),
    })
      .options({ abortEarly: false })
      .validate(input);
  }
}
