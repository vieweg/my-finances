import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, currencyHeader, includeDeletedParam, paginated } from '../helpers';
import { PAGINATION_WALLETS, VALID_CURRENCIES, MAX_BALANCE_SERIES_PERIODS } from '../../constants';

const CreateWalletBody = s(
  Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    currency: Joi.string()
      .valid(...VALID_CURRENCIES)
      .required(),
  }),
);

const UpdateWalletBody = s(Joi.object({ name: Joi.string().trim().min(1).max(100).required() }));

const AdjustWalletBody = s(
  Joi.object({
    amount: Joi.number().required().description('New absolute balance for this wallet'),
    recordedAt: Joi.date()
      .optional()
      .description('Date the balance is set on (also its `effectiveAt`). Defaults to now if omitted'),
  }),
);

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
      maximum: PAGINATION_WALLETS.MAX_LIMIT,
      default: PAGINATION_WALLETS.DEFAULT_LIMIT,
    },
    description: `Items per page (max: ${PAGINATION_WALLETS.MAX_LIMIT})`,
  },
];

export const walletsPaths = {
  '/api/wallets': {
    get: {
      tags: ['Wallets'],
      summary: 'List wallets',
      description: 'Returns all wallets for the authenticated user, each with its current balance.',
      security,
      parameters: [
        ...paginationParams,
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: PAGINATION_WALLETS.SORT_BY },
          description: 'Field to sort by',
        },
        {
          name: 'sortOrder',
          in: 'query',
          schema: { type: 'string', enum: PAGINATION_WALLETS.SORT_ORDER },
          description: 'Sort direction',
        },
        {
          name: 'currency',
          in: 'query',
          schema: { type: 'string', enum: [...VALID_CURRENCIES] },
          description: 'Overrides X-Currency header for this request',
        },
        currencyHeader,
        {
          name: 'deleted',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'When true, return only soft-deleted entries',
        },
      ],
      responses: {
        200: jsonResponse(paginated(ref('Wallet'))),
        401: r[401],
      },
    },
    post: {
      tags: ['Wallets'],
      summary: 'Create wallet',
      description: 'Creates a new wallet. Currency is fixed at creation and cannot be changed.',
      security,
      requestBody: jsonBody(CreateWalletBody),
      responses: {
        201: jsonResponse(ref('Wallet')),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/wallets/reorder': {
    patch: {
      tags: ['Wallets'],
      summary: 'Reorder wallets',
      description:
        'Sets the display position of wallets by providing every wallet ID in the desired order. When `currency` is specified, only wallets of that currency need to be included; otherwise all wallet IDs must be provided.',
      security,
      requestBody: jsonBody(
        s(
          Joi.object({
            ids: Joi.array()
              .items(Joi.string().uuid())
              .min(1)
              .required()
              .description('Wallet IDs in the desired display order'),
            currency: Joi.string()
              .valid(...VALID_CURRENCIES)
              .optional()
              .description('When provided, restricts reordering to wallets of this currency only'),
          }),
        ),
      ),
      responses: {
        204: r[204],
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/wallets/balance-series': {
    get: {
      tags: ['Wallets'],
      summary: 'Balance over time',
      description:
        'Balance of each wallet at the end of every period in the range, for charts. Periods with no activity repeat the previous balance. ' +
        "Balances use each entry's `effectiveAt` (the transaction's date or the adjustment date), not when it was saved: the balance at a date is the sum of the changes effective on or before it. " +
        `Returns 400 when the range has more than ${MAX_BALANCE_SERIES_PERIODS} periods.`,
      security,
      parameters: [
        {
          name: 'startDate',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date' },
          description: 'First day of the range (YYYY-MM-DD)',
        },
        {
          name: 'endDate',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date' },
          description: 'Last day of the range, inclusive (YYYY-MM-DD)',
        },
        {
          name: 'interval',
          in: 'query',
          schema: { type: 'string', enum: ['day', 'week', 'month'] },
          description: 'Period length. Defaults by range: up to 45 days by day, up to 6 months by week, longer by month. Weeks start on Monday',
        },
        {
          name: 'walletId',
          in: 'query',
          schema: { type: 'array', items: { type: 'string', format: 'uuid' } },
          style: 'form',
          explode: true,
          description:
            'Wallets to include, repeatable. Soft-deleted wallets are included when asked for here. Defaults to all active wallets (of the X-Currency, when set)',
        },
        {
          name: 'timezone',
          in: 'query',
          schema: { type: 'string', example: 'America/Sao_Paulo' },
          description: 'IANA time zone where days, weeks and months start. Defaults to the server APP_TIMEZONE (UTC when unset)',
        },
        {
          ...currencyHeader,
          description: 'Without walletId, only wallets of this currency are included. Ignored when walletId is set',
        },
      ],
      responses: {
        200: jsonResponse(ref('BalanceSeries')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}': {
    get: {
      tags: ['Wallets'],
      summary: 'Get wallet',
      description:
        'Returns the wallet with its current balance and up to 10 most recent balance snapshots.',
      security,
      parameters: [idParam(), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('WalletWithHistory')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Wallets'],
      summary: 'Update wallet name',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(UpdateWalletBody),
      responses: {
        200: jsonResponse(ref('Wallet')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Wallets'],
      summary: 'Soft-delete wallet',
      security,
      parameters: [idParam()],
      responses: {
        204: r[204],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}/remove': {
    delete: {
      tags: ['Wallets'],
      summary: 'Hard-delete wallet',
      description:
        'Permanently removes the wallet and all its balance snapshots. Linked transactions are preserved but their walletId is set to null.',
      security,
      parameters: [idParam()],
      responses: {
        204: r[204],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}/restore': {
    patch: {
      tags: ['Wallets'],
      summary: 'Restore a soft-deleted wallet',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Wallet')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}/adjust': {
    post: {
      tags: ['Wallets'],
      summary: 'Manual balance adjustment',
      description:
        'Sets the wallet balance to the provided absolute `amount`, recording the difference as a manual snapshot.',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(AdjustWalletBody),
      responses: {
        200: jsonResponse(ref('Wallet')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}/history': {
    get: {
      tags: ['Wallets'],
      summary: 'Get balance history',
      description:
        'Paginated list of all balance snapshots, ordered by `effectiveAt` from most recent to oldest (the order the balance series uses).',
      security,
      parameters: [
        idParam(),
        ...paginationParams,
        {
          name: 'startDate',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Filter snapshots with effectiveAt on or after this date',
        },
        {
          name: 'endDate',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Filter snapshots with effectiveAt on or before this date',
        },
      ],
      responses: {
        200: jsonResponse(ref('WalletHistory')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/wallets/{id}/history/{snapshotId}': {
    delete: {
      tags: ['Wallets'],
      summary: 'Delete a manual adjustment',
      description:
        'Removes a manual balance snapshot. Only manual adjustments can be deleted — transaction-linked snapshots are managed via the transaction itself. The delta of the next (more recent) snapshot is recalculated automatically.',
      security,
      parameters: [idParam('id', 'Wallet UUID'), idParam('snapshotId', 'Snapshot UUID')],
      responses: {
        204: r[204],
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
