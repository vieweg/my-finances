import Joi, { ValidationResult } from 'joi';
import { VALID_CURRENCIES, PAGINATION_CONTRACTS, NOTES_MAX_LENGTH } from '../../../constants';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractQueryDto,
  ListContractsDto,
  GenerateForContractDto,
} from '../dtos';

const notesSchema = Joi.string().trim().max(NOTES_MAX_LENGTH).allow(null, '').optional();

const tagSchema = Joi.alternatives().try(
  Joi.string().min(3).max(50).trim(),
  Joi.object({ id: Joi.string().uuid().required(), name: Joi.string().required() }),
);

export class ValidateContract {
  static create(data: CreateContractDto): ValidationResult<CreateContractDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().min(1).max(150).required(),
      contactId: Joi.string().uuid().required(),
      walletId: Joi.string().uuid().optional(),
      type: Joi.string().valid('payable', 'receivable').required(),
      amount: Joi.number().positive().required(),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).required(),
      }),
      description: Joi.string().trim().min(1).required(),
      notes: notesSchema,
      tags: Joi.array().items(tagSchema).optional(),
      instalments: Joi.number().integer().min(0).required(),
      cycleMonths: Joi.number().integer().min(1).max(12).required(),
      firstDueDate: Joi.date().required(),
    }).options({ abortEarly: false }).validate(data);
  }

  static update(data: UpdateContractDto): ValidationResult<UpdateContractDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().min(1).max(150).optional(),
      contactId: Joi.string().uuid().optional(),
      walletId: Joi.string().uuid().allow(null).optional(),
      amount: Joi.number().positive().optional(),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).optional(),
      }),
      description: Joi.string().trim().min(1).optional(),
      notes: notesSchema,
      tags: Joi.array().items(tagSchema).optional(),
      instalments: Joi.number().integer().min(0).optional(),
      cycleMonths: Joi.number().integer().min(1).max(12).optional(),
      firstDueDate: Joi.date().optional(),
    }).options({ abortEarly: false }).validate(data);
  }

  static query(data: ContractQueryDto): ValidationResult<ContractQueryDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      remove: Joi.string().valid('remove').optional(),
      deleted: Joi.boolean().optional(),
    }).validate(data);
  }

  static list(data: ListContractsDto): ValidationResult<ListContractsDto> {
    return Joi.object({
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_CONTRACTS.MAX_LIMIT).optional(),
      sortBy: Joi.string().valid(...PAGINATION_CONTRACTS.SORT_BY).optional(),
      sortOrder: Joi.string().valid(...PAGINATION_CONTRACTS.SORT_ORDER).optional(),
      filterByStatus: Joi.string().valid('active', 'completed', 'cancelled').optional(),
      filterByType: Joi.string().valid('payable', 'receivable').optional(),
      filterByContactId: Joi.string().uuid().optional(),
      filterByContactName: Joi.string().trim().min(1).max(255).optional(),
      filterByCurrency: Joi.string().valid(...VALID_CURRENCIES).optional(),
      name: Joi.string().trim().min(1).max(150).optional(),
      description: Joi.string().trim().min(1).max(255).optional(),
      search: Joi.string().trim().min(1).max(255).optional(),
      deleted: Joi.boolean().optional(),
      includeCompleted: Joi.boolean().optional(),
    }).options({ abortEarly: false }).validate(data);
  }

  static generateFor(data: GenerateForContractDto): ValidationResult<GenerateForContractDto> {
    return Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
    }).validate(data);
  }
}
