import Joi, { ValidationResult } from 'joi';
import { VALID_CURRENCIES, PAGINATION_INVOICES, NOTES_MAX_LENGTH, REASON_MAX_LENGTH } from '../../../constants';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  AddInvoiceTransactionDto,
  MarkPaidDto,
  InvoiceQueryDto,
  ListInvoicesDto,
} from '../dtos';

const notesSchema = Joi.string().trim().max(NOTES_MAX_LENGTH).allow(null, '').optional();

const tagSchema = Joi.alternatives().try(
  Joi.string().min(3).max(50).trim(),
  Joi.object({ id: Joi.string().uuid().required(), name: Joi.string().required() }),
);

export class ValidateInvoice {
  static create(data: CreateInvoiceDto): ValidationResult<CreateInvoiceDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      contactId: Joi.string().uuid().required(),
      walletId: Joi.string().uuid().optional(),
      type: Joi.string().valid('payable', 'receivable').required(),
      amount: Joi.number().positive().required(),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).required(),
      }),
      issueDate: Joi.date().required(),
      dueDate: Joi.date().min(Joi.ref('issueDate')).required(),
      description: Joi.string().trim().required(),
      notes: notesSchema,
      tags: Joi.array().items(tagSchema).optional(),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }

  static update(data: UpdateInvoiceDto): ValidationResult<UpdateInvoiceDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      contactId: Joi.string().uuid().optional(),
      walletId: Joi.string().uuid().allow(null).optional(),
      amount: Joi.number().positive().optional(),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).optional(),
      }),
      issueDate: Joi.date().optional(),
      dueDate: Joi.date().optional(),
      description: Joi.string().trim().allow(null, '').optional(),
      notes: notesSchema,
      tags: Joi.array().items(tagSchema).optional(),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }

  static addTransaction(data: AddInvoiceTransactionDto): ValidationResult<AddInvoiceTransactionDto> {
    const schema = Joi.object({
      invoiceId: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      date: Joi.date().required(),
      total: Joi.number().positive().required(),
      walletId: Joi.string().uuid().allow(null).optional(),
      currency: Joi.when('walletId', {
        is: Joi.string().uuid().exist(),
        then: Joi.forbidden().messages({ 'any.unknown': '"currency" must not be provided when walletId is set' }),
        otherwise: Joi.string().valid(...VALID_CURRENCIES).optional(),
      }),
      description: Joi.string().trim().required(),
      notes: notesSchema,
      tags: Joi.array().items(tagSchema).optional(),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }

  static markPaid(data: MarkPaidDto): ValidationResult<MarkPaidDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
    });
    return schema.validate(data);
  }

  static query(data: InvoiceQueryDto): ValidationResult<InvoiceQueryDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      remove: Joi.string().valid('remove').optional(),
      deleted: Joi.boolean().optional(),
      reason: Joi.string().trim().max(REASON_MAX_LENGTH).allow('').optional(),
    });
    return schema.validate(data);
  }

  static list(data: ListInvoicesDto): ValidationResult<ListInvoicesDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(PAGINATION_INVOICES.MAX_LIMIT).optional(),
      sortBy: Joi.string().valid(...PAGINATION_INVOICES.SORT_BY).optional(),
      sortOrder: Joi.string().valid(...PAGINATION_INVOICES.SORT_ORDER).optional(),
      filterByType: Joi.string().valid('payable', 'receivable').optional(),
      filterByStatus: Joi.alternatives()
        .try(
          Joi.string().valid('pending', 'partial', 'paid', 'cancelled'),
          Joi.array().items(Joi.string().valid('pending', 'partial', 'paid', 'cancelled')).min(1),
        )
        .optional(),
      filterByIsOverdue: Joi.boolean().optional(),
      filterByCurrency: Joi.string().valid(...VALID_CURRENCIES).optional(),
      filterByContactId: Joi.string().uuid().optional(),
      filterByContactName: Joi.string().trim().min(1).max(255).optional(),
      search: Joi.string().trim().min(1).max(255).optional(),
      filterByDateRange: Joi.when('forecast', {
        is: true,
        then: Joi.object({
          startDate: Joi.date().required(),
          endDate: Joi.date().optional(),
        }).required(),
        otherwise: Joi.object({
          startDate: Joi.date().optional(),
          endDate: Joi.date().optional(),
        }).optional(),
      }),
      description: Joi.string().trim().min(1).max(255).optional(),
      filterByTag: Joi.array().items(Joi.string().trim().min(1).max(50)).min(1).optional(),
      filterByTagId: Joi.array().items(Joi.string().uuid()).min(1).optional(),
      deleted: Joi.boolean().optional(),
      contractId: Joi.string().uuid().optional(),
      forecast: Joi.boolean().optional(),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }
}
