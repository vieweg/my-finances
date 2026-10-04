import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, currencyHeader, includeDeletedParam, paginated } from '../helpers';
import { VALID_CURRENCIES, PAGINATION_INVOICES, NOTES_MAX_LENGTH, REASON_MAX_LENGTH } from '../../constants';

const tagSchema = Joi.alternatives().try(
  Joi.string().min(3).max(50),
  Joi.object({ id: Joi.string().uuid(), name: Joi.string() }),
);

const notes = Joi.string().max(NOTES_MAX_LENGTH).allow(null, '').optional().description('Free-text notes');

const reasonBody = (description: string) => ({
  required: false,
  content: {
    'application/json': {
      schema: s(Joi.object({ reason: Joi.string().max(REASON_MAX_LENGTH).allow('').optional().description(description) })),
    },
  },
});

const CreateInvoiceBody = s(
  Joi.object({
    contactId: Joi.string().uuid().required(),
    walletId: Joi.string().uuid().optional().description('When set, the wallet currency is used and "currency" must not be provided.'),
    type: Joi.string().valid('payable', 'receivable').required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid(...VALID_CURRENCIES).optional().description('Required when walletId is not set. Must be omitted when walletId is provided.'),
    issueDate: Joi.date().required(),
    dueDate: Joi.date().required(),
    description: Joi.string().required(),
    notes,
    tags: Joi.array().items(tagSchema).optional(),
  }),
);

const UpdateInvoiceBody = s(
  Joi.object({
    contactId: Joi.string().uuid().optional(),
    walletId: Joi.string().uuid().allow(null).optional().description('Set to null to detach wallet. When set to a UUID, the wallet currency is used and "currency" must not be provided.'),
    amount: Joi.number().positive().optional(),
    currency: Joi.string().valid(...VALID_CURRENCIES).optional().description('Ignored when walletId is set to a UUID. Required when clearing the wallet (walletId: null) if you want to change the currency.'),
    issueDate: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    description: Joi.string().allow(null, '').optional(),
    notes,
    tags: Joi.array().items(tagSchema).optional(),
  }),
);

const AddTransactionBody = s(
  Joi.object({
    date: Joi.date().required(),
    total: Joi.number().positive().required(),
    currency: Joi.string().valid(...VALID_CURRENCIES).optional(),
    description: Joi.string().required(),
    walletId: Joi.string().uuid().allow(null).optional(),
    notes: Joi.string().max(NOTES_MAX_LENGTH).allow(null, '').optional().description('Notes of the payment transaction'),
    tags: Joi.array().items(tagSchema).optional(),
  }),
);

const invoiceListParams = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: PAGINATION_INVOICES.DEFAULT_PAGE },
    description: 'Page number',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: PAGINATION_INVOICES.MAX_LIMIT, default: PAGINATION_INVOICES.DEFAULT_LIMIT },
    description: `Items per page (max: ${PAGINATION_INVOICES.MAX_LIMIT})`,
  },
  {
    name: 'sortBy',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_INVOICES.SORT_BY, default: PAGINATION_INVOICES.DEFAULT_SORT_BY },
    description: 'Field to sort by. `amount` and `outstanding` are signed: receivables positive, payables negative',
  },
  {
    name: 'sortOrder',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_INVOICES.SORT_ORDER, default: 'asc' },
    description: 'Sort direction',
  },
  {
    name: 'filterByType',
    in: 'query',
    schema: { type: 'string', enum: ['payable', 'receivable'] },
    description: 'Filter by invoice type',
  },
  {
    name: 'filterByStatus',
    in: 'query',
    schema: {
      oneOf: [
        { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] },
        { type: 'array', items: { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] } },
      ],
    },
    style: 'form',
    explode: true,
    description: 'Filter by invoice status (single value or multiple)',
  },
  {
    name: 'filterByIsOverdue',
    in: 'query',
    schema: { type: 'boolean' },
    description: 'Filter by overdue state — pending/partial invoices whose dueDate is in the past',
  },
  {
    name: 'filterByCurrency',
    in: 'query',
    schema: { type: 'string', enum: [...VALID_CURRENCIES] },
    description: 'Filter by currency',
  },
  {
    name: 'filterByContactId',
    in: 'query',
    schema: { type: 'string', format: 'uuid' },
    description: 'Filter by contact (exact UUID match)',
  },
  {
    name: 'filterByContactName',
    in: 'query',
    schema: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Partial text search on contact name (case-insensitive LIKE)',
  },
  {
    name: 'startDate',
    in: 'query',
    schema: { type: 'string', format: 'date' },
    description: 'Return invoices with dueDate on or after this date',
  },
  {
    name: 'endDate',
    in: 'query',
    schema: { type: 'string', format: 'date' },
    description: 'Return invoices with dueDate on or before this date (inclusive, end of day)',
  },
  {
    name: 'description',
    in: 'query',
    schema: { type: 'string' },
    description: 'Partial text search on description',
  },
  {
    name: 'search',
    in: 'query',
    schema: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Partial text search across description, notes OR contact name. Projected invoices match on description or contact name',
  },
  {
    name: 'filterByTag',
    in: 'query',
    schema: { type: 'array', items: { type: 'string' } },
    style: 'form',
    explode: true,
    description:
      'Filter by tag name fragments ("food" also matches "seafood") — multiple values are ANDed. Use `filterByTagId` for exact matches',
  },
  {
    name: 'filterByTagId',
    in: 'query',
    schema: { type: 'array', items: { type: 'string', format: 'uuid' } },
    style: 'form',
    explode: true,
    description: 'Filter by exact tag id — multiple values are ANDed. Does not apply to projected invoices',
  },
  {
    name: 'deleted',
    in: 'query',
    schema: { type: 'boolean' },
    description: 'When true, return only soft-deleted entries',
  },
  {
    name: 'forecast',
    in: 'query',
    schema: { type: 'boolean' },
    description:
      'When true, merges real invoices with projected ones computed from active contracts. ' +
      'startDate becomes required. Each item gains a `projected` boolean field. ' +
      'Projected items have status "projected", no id, and no createdAt/updatedAt.',
  },
];

export const invoicesPaths = {
  '/api/invoices': {
    get: {
      tags: ['Invoices'],
      summary: 'List invoices',
      security,
      parameters: [currencyHeader, ...invoiceListParams],
      responses: {
        200: jsonResponse(paginated({ oneOf: [ref('Invoice'), ref('ProjectedInvoice')] })),
        400: r[400],
        401: r[401],
      },
    },
    post: {
      tags: ['Invoices'],
      summary: 'Create invoice',
      security,
      parameters: [currencyHeader],
      requestBody: jsonBody(CreateInvoiceBody),
      responses: {
        201: jsonResponse(ref('Invoice'), 'Created'),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}': {
    get: {
      tags: ['Invoices'],
      summary: 'Get invoice by id',
      description: 'Returns the invoice with its full transaction list and paidAmount.',
      security,
      parameters: [idParam(), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('InvoiceWithTransactions')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Invoices'],
      summary: 'Update invoice',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(UpdateInvoiceBody),
      responses: {
        200: jsonResponse(ref('Invoice')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Invoices'],
      summary: 'Soft-delete (cancel) invoice',
      description: 'Sets the status to cancelled and appends a "cancelled" event to history, with the optional reason.',
      security,
      parameters: [idParam()],
      requestBody: reasonBody('Why the invoice is cancelled — stored on the "cancelled" history event'),
      responses: {
        200: jsonResponse(ref('Invoice')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}/remove': {
    delete: {
      tags: ['Invoices'],
      summary: 'Hard-delete invoice',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Invoice')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}/transactions': {
    post: {
      tags: ['Invoices'],
      summary: 'Add payment transaction to invoice',
      description:
        'Creates a transaction linked to this invoice. Transaction type is derived from the invoice type (receivable → income, payable → outcome). Tags are merged with the invoice tags. Updates invoice status to partial or paid.',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(AddTransactionBody),
      responses: {
        201: jsonResponse(ref('InvoiceWithTransactions'), 'Transaction added'),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}/mark-paid': {
    patch: {
      tags: ['Invoices'],
      summary: 'Force-mark invoice as paid',
      description: 'Sets status to paid regardless of the total linked transactions amount.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Invoice')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}/unmark-paid': {
    patch: {
      tags: ['Invoices'],
      summary: 'Unmark invoice as paid',
      description: 'Recalculates invoice status from linked transactions (paid/partial/pending). Returns 400 if the invoice is fully covered by transactions — remove a transaction or increase the invoice amount first.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('InvoiceWithTransactions')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/invoices/{id}/restore': {
    patch: {
      tags: ['Invoices'],
      summary: 'Restore a cancelled invoice',
      description: 'Clears deletedAt and recalculates status from linked transaction amounts. Appends a "restored" event to history, with the optional reason. Returns the invoice with its full transaction list.',
      security,
      parameters: [idParam()],
      requestBody: reasonBody('Why the invoice is restored — stored on the "restored" history event'),
      responses: {
        200: jsonResponse(ref('InvoiceWithTransactions')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
