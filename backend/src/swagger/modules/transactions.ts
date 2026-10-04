import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, currencyHeader, includeDeletedParam, paginated } from '../helpers';
import { PAGINATION_TRANSACTIONS, VALID_CURRENCIES, NOTES_MAX_LENGTH } from '../../constants';

const TagInput = s(
  Joi.alternatives().try(
    Joi.string()
      .min(3)
      .max(50)
      .trim()
      .description('Tag name — created automatically if it does not exist'),
    Joi.object({ id: Joi.string().uuid().required(), name: Joi.string().required() }).description(
      'Existing tag reference',
    ),
  ),
);

const TransactionBody = s(
  Joi.object({
    date: Joi.date().required(),
    total: Joi.number().required(),
    walletId: Joi.string().uuid().optional().allow(null).description('Wallet to associate with this transaction. When set, the wallet currency is used and "currency" must not be provided.'),
    currency: Joi.string()
      .valid(...VALID_CURRENCIES)
      .optional()
      .description('Required when neither walletId nor X-Currency header is set. Must be omitted when walletId is provided or X-Currency header is present.'),
    description: Joi.string().trim().required(),
    type: Joi.string().valid('income', 'outcome').required(),
    notes: Joi.string()
      .max(NOTES_MAX_LENGTH)
      .allow(null, '')
      .optional()
      .description('Free-text notes. On update, omitting notes keeps the current ones; send null or "" to clear them.'),
    tags: Joi.array()
      .optional()
      .description('Array of tag names (string) or existing tag objects {id, name}'),
  }),
);

// joi-to-swagger does not reliably handle array multi-type items
(TransactionBody as any).properties.tags = { type: 'array', items: TagInput };

const paginationParams = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number',
  },
  {
    name: 'limit',
    in: 'query',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGINATION_TRANSACTIONS.MAX_LIMIT,
      default: PAGINATION_TRANSACTIONS.DEFAULT_LIMIT,
    },
    description: `Items per page (max: ${PAGINATION_TRANSACTIONS.MAX_LIMIT})`,
  },
];

const sortParams = [
  {
    name: 'sortBy',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_TRANSACTIONS.SORT_BY },
    description: 'Field to sort by',
  },
  {
    name: 'sortOrder',
    in: 'query',
    schema: { type: 'string', enum: PAGINATION_TRANSACTIONS.SORT_ORDER },
    description: 'Sort direction',
  },
];

export const transactionsPaths = {
  '/api/transactions/summary': {
    get: {
      tags: ['Transactions'],
      summary: 'Monthly summary',
      description:
        'Returns aggregated income, outcome, balance, and cumulative last-month balance for a given currency and month/year. Intended for the dashboard summary card. Call once per currency to render a split view across multiple currencies.',
      security,
      parameters: [
        {
          name: 'month',
          in: 'query',
          required: true,
          schema: { type: 'integer', minimum: 1, maximum: 12 },
          description: 'Month number (1 = January, 12 = December)',
        },
        {
          name: 'year',
          in: 'query',
          required: true,
          schema: { type: 'integer', minimum: 2000, maximum: 2100 },
          description: 'Four-digit year',
        },
        {
          name: 'currency',
          in: 'query',
          required: true,
          schema: { type: 'string', enum: [...VALID_CURRENCIES] },
          description: 'ISO 4217 currency code to summarise',
        },
      ],
      responses: {
        200: jsonResponse(ref('TransactionMonthlySummary')),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/transactions': {
    get: {
      tags: ['Transactions'],
      summary: 'List transactions',
      description:
        'Returns the latest version of each transaction. Pass `deleted=true` to list soft-deleted transactions instead (trash view — only the latest version of each deleted group is returned).',
      security,
      parameters: [
        ...paginationParams,
        ...sortParams,
        {
          name: 'filterByType',
          in: 'query',
          schema: { type: 'string', enum: ['income', 'outcome'] },
        },
        {
          name: 'filterByCurrency',
          in: 'query',
          schema: { type: 'string', enum: [...VALID_CURRENCIES] },
          description: 'Filter by currency. Only available when X-Currency header is not set — the header takes precedence.',
        },
        currencyHeader,
        {
          name: 'startDate',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Filter transactions on or after this date',
        },
        {
          name: 'endDate',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Filter transactions on or before this date',
        },
        {
          name: 'description',
          in: 'query',
          schema: { type: 'string' },
          description: 'Case-insensitive partial match on description only. See also `search`',
        },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string', minLength: 1, maxLength: 255 },
          description:
            'Case-insensitive partial match on description, notes, wallet name (deleted wallets included) OR tag names',
        },
        {
          name: 'filterByTag',
          in: 'query',
          schema: { type: 'array', items: { type: 'string' } },
          style: 'form',
          explode: true,
          description:
            'Partial tag name match ("food" also matches "seafood"), AND logic — repeat for each term (e.g. filterByTag=food&filterByTag=travel). Use `filterByTagId` for exact matches',
        },
        {
          name: 'filterByTagId',
          in: 'query',
          schema: { type: 'array', items: { type: 'string', format: 'uuid' } },
          style: 'form',
          explode: true,
          description: 'Exact tag id match, AND logic — repeat for each tag (e.g. filterByTagId=<id1>&filterByTagId=<id2>)',
        },
        {
          name: 'deleted',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'When true, return only soft-deleted entries',
        },
      ],
      responses: {
        200: jsonResponse(paginated(ref('Transaction'))),
        400: r[400],
        401: r[401],
      },
    },
    post: {
      tags: ['Transactions'],
      summary: 'Create transaction',
      description:
        'Tags can be passed as strings (created automatically) or as `{id, name}` objects referencing existing tags. Currency is resolved in priority order: `walletId` (wallet currency) → `X-Currency` header → `currency` body field.',
      security,
      parameters: [currencyHeader],
      requestBody: jsonBody(TransactionBody),
      responses: {
        200: jsonResponse(ref('Transaction')),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/transactions/{id}': {
    get: {
      tags: ['Transactions'],
      summary: 'Get transaction',
      description:
        'Returns the latest version with up to 5 previous versions inline in the `history` array.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)'), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('TransactionWithHistory')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Transactions'],
      summary: 'Update transaction',
      description:
        'Creates a new version. The previous version is soft-deleted and preserved in history, notes included. Currency is resolved in priority order: `walletId` (wallet currency) → `X-Currency` header → `currency` body field.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)'), currencyHeader],
      requestBody: jsonBody(TransactionBody),
      responses: {
        200: jsonResponse(ref('Transaction'), 'New version created'),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Transactions'],
      summary: 'Soft-delete transaction',
      description:
        'Soft-deletes all versions of the transaction. History is preserved and the transaction disappears from the list. If the transaction is linked to an invoice, the invoice status and paid amount are recalculated.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)')],
      responses: {
        200: jsonResponse(ref('Transaction')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/transactions/{id}/remove': {
    delete: {
      tags: ['Transactions'],
      summary: 'Hard-delete transaction',
      description: 'Permanently removes all versions. Irreversible. If the transaction is linked to an invoice, the invoice status and paid amount are recalculated.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)')],
      responses: {
        200: { description: 'Transaction permanently deleted' },
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/transactions/{id}/history': {
    get: {
      tags: ['Transactions'],
      summary: 'Get full version history',
      description:
        'Paginated list of all versions (including soft-deleted ones), ordered from most recent to oldest.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)'), ...paginationParams],
      responses: {
        200: jsonResponse(ref('TransactionHistory')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/transactions/{id}/restore': {
    patch: {
      tags: ['Transactions'],
      summary: 'Restore a soft-deleted transaction',
      description:
        'Restores the latest version of a deleted transaction as a new version, re-applying its wallet balance and recalculating the linked invoice status. To restore an older version use `POST /api/transactions/{id}/restore/{versionId}`.',
      security,
      parameters: [idParam('id', 'Stable transaction id (originalId)')],
      responses: {
        200: jsonResponse(ref('Transaction')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/transactions/{id}/restore/{versionId}': {
    post: {
      tags: ['Transactions'],
      summary: 'Restore a previous version',
      description:
        'Copies the data, notes and tags from `versionId` into a new version. Does not modify any existing versions — history remains intact.',
      security,
      parameters: [
        idParam('id', 'Stable transaction id (originalId)'),
        idParam(
          'versionId',
          'The specific version row id to restore (from `versionId` field in history)',
        ),
      ],
      responses: {
        200: jsonResponse(ref('Transaction'), 'New version created from historical data'),
        401: r[401],
        404: r[404],
      },
    },
  },
};
