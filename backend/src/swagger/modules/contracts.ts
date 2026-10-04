import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, currencyHeader, includeDeletedParam, paginated } from '../helpers';
import { VALID_CURRENCIES, PAGINATION_CONTRACTS, NOTES_MAX_LENGTH } from '../../constants';

const tagSchema = Joi.alternatives().try(
  Joi.string().min(3).max(50),
  Joi.object({ id: Joi.string().uuid(), name: Joi.string() }),
);

const notes = Joi.string().max(NOTES_MAX_LENGTH).allow(null, '').optional().description('Free-text notes');

const CreateContractBody = s(
  Joi.object({
    name: Joi.string().min(1).max(150).required(),
    contactId: Joi.string().uuid().required(),
    walletId: Joi.string().uuid().optional().description('When set, the wallet currency is used and "currency" must not be provided.'),
    type: Joi.string().valid('payable', 'receivable').required(),
    amount: Joi.number().positive().required().description('Per-instalment invoice amount'),
    currency: Joi.string().valid(...VALID_CURRENCIES).optional().description('Required when walletId is not set. Must be omitted when walletId is provided.'),
    description: Joi.string().min(1).required().description('Supports template tags resolved when invoices are generated: [month] (e.g. "June 2026"), [instalment] (e.g. "3 of 12"), [contact_name], [value] (e.g. "£1,500.00"), [period] (e.g. "20/01/2026 - 19/02/2026").'),
    notes,
    tags: Joi.array().items(tagSchema).optional(),
    instalments: Joi.number().integer().min(0).required().description('Number of invoices to generate. 0 = infinite (recurrent).'),
    cycleMonths: Joi.number().integer().min(1).max(12).required().description('Interval between invoices in months (1–12).'),
    firstDueDate: Joi.date().required().description('Due date of the first invoice. Subsequent due dates are calculated from this.'),
  }),
);

const UpdateContractBody = s(
  Joi.object({
    name: Joi.string().min(1).max(150).optional(),
    contactId: Joi.string().uuid().optional(),
    walletId: Joi.string().uuid().allow(null).optional().description('Set to null to detach wallet.'),
    amount: Joi.number().positive().optional(),
    currency: Joi.string().valid(...VALID_CURRENCIES).optional(),
    description: Joi.string().min(1).optional().description('Supports template tags resolved when invoices are generated: [month] (e.g. "June 2026"), [instalment] (e.g. "3 of 12"), [contact_name], [value] (e.g. "£1,500.00"), [period] (e.g. "20/01/2026 - 19/02/2026").'),
    notes,
    tags: Joi.array().items(tagSchema).optional(),
    instalments: Joi.number().integer().min(0).optional(),
    cycleMonths: Joi.number().integer().min(1).max(12).optional(),
    firstDueDate: Joi.date().optional().description('Changing firstDueDate or cycleMonths recalculates nextDueDate.'),
  }),
);

const contractListParams = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: PAGINATION_CONTRACTS.DEFAULT_PAGE },
    description: 'Page number',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: PAGINATION_CONTRACTS.MAX_LIMIT, default: PAGINATION_CONTRACTS.DEFAULT_LIMIT },
    description: `Items per page (max: ${PAGINATION_CONTRACTS.MAX_LIMIT})`,
  },
  {
    name: 'sortBy',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_CONTRACTS.SORT_BY, default: PAGINATION_CONTRACTS.DEFAULT_SORT_BY },
    description: 'Field to sort by. `amount` is signed: receivables positive, payables negative',
  },
  {
    name: 'sortOrder',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_CONTRACTS.SORT_ORDER, default: 'asc' },
    description: 'Sort direction',
  },
  {
    name: 'filterByStatus',
    in: 'query',
    schema: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
    description: 'Filter by contract status',
  },
  {
    name: 'filterByType',
    in: 'query',
    schema: { type: 'string', enum: ['payable', 'receivable'] },
    description: 'Filter by contract type',
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
    name: 'filterByCurrency',
    in: 'query',
    schema: { type: 'string', enum: [...VALID_CURRENCIES] },
    description: 'Filter by currency. Cannot be combined with X-Currency header.',
  },
  {
    name: 'name',
    in: 'query',
    schema: { type: 'string' },
    description: 'Partial text search on contract name',
  },
  {
    name: 'description',
    in: 'query',
    schema: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Partial text search on contract description',
  },
  {
    name: 'search',
    in: 'query',
    schema: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Partial text search across description, notes OR contact name',
  },
  {
    name: 'deleted',
    in: 'query',
    schema: { type: 'boolean' },
    description: 'When true, return only soft-deleted (cancelled) contracts',
  },
  {
    name: 'includeCompleted',
    in: 'query',
    schema: { type: 'boolean' },
    description: 'By default only active contracts are listed; when true, completed contracts are included. Ignored when filterByStatus is set',
  },
];

export const contractsPaths = {
  '/api/contracts': {
    get: {
      tags: ['Contracts'],
      summary: 'List contracts',
      security,
      parameters: [currencyHeader, ...contractListParams],
      responses: {
        200: jsonResponse(paginated(ref('Contract'))),
        400: r[400],
        401: r[401],
      },
    },
    post: {
      tags: ['Contracts'],
      summary: 'Create contract',
      security,
      parameters: [currencyHeader],
      requestBody: jsonBody(CreateContractBody),
      responses: {
        201: jsonResponse(ref('Contract'), 'Created'),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}': {
    get: {
      tags: ['Contracts'],
      summary: 'Get contract by id',
      description:
        'Returns the contract with its generated invoices (with paid and outstanding amounts) and contract-level totals.',
      security,
      parameters: [idParam(), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('ContractWithInvoices')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Contracts'],
      summary: 'Update contract',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(UpdateContractBody),
      responses: {
        200: jsonResponse(ref('Contract')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Contracts'],
      summary: 'Soft-delete (cancel) contract',
      description: 'Sets status to cancelled and soft-deletes the contract. Previously generated invoices are preserved with contractId set to null.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Contract')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}/remove': {
    delete: {
      tags: ['Contracts'],
      summary: 'Hard-delete contract',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Contract')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}/restore': {
    patch: {
      tags: ['Contracts'],
      summary: 'Restore a cancelled contract',
      description:
        'Clears deletedAt and sets the status back to active (or completed when all instalments were generated). Invoices missed while the contract was deleted are generated by the scheduled job, one per run.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('ContractWithInvoices')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}/complete': {
    patch: {
      tags: ['Contracts'],
      summary: 'Complete an active contract',
      description:
        'Ends a recurring contract, or one with instalments left, without deleting it. Invoices already generated are kept and no new ones are generated.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('ContractWithInvoices')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}/reactivate': {
    patch: {
      tags: ['Contracts'],
      summary: 'Reactivate a completed contract',
      description:
        'Sets a completed contract that still has instalments left back to active (use PUT to increase instalments of a contract that generated all of them). Invoices missed while completed are generated by the scheduled job, one per run.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('ContractWithInvoices')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contracts/{id}/generate': {
    post: {
      tags: ['Contracts'],
      summary: 'Manually generate next invoice',
      description: 'Creates the next instalment invoice immediately, ignoring the scheduled nextDueDate. Advances instalmentsDone and nextDueDate. If the contract reaches its instalment limit it is automatically marked completed.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(
          { type: 'object', properties: { generated: { type: 'integer' } } },
          'Number of invoices generated',
        ),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
