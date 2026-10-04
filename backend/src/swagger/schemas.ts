import { paginated, ref } from './helpers';
import { NOTES_MAX_LENGTH } from '../constants';

const money = (description?: string) => ({
  type: 'object',
  ...(description && { description }),
  properties: {
    amount: { type: 'number' },
    currency: { type: 'string' },
  },
});

const wallet = {
  allOf: [ref('WalletSummary')],
  nullable: true,
  description: 'Wallet this record is linked to, also when the wallet was soft-deleted (then `deletedAt` is set)',
};

const notes = { type: 'string', nullable: true, maxLength: NOTES_MAX_LENGTH, description: 'Free-text notes' };

export const schemas = {
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer', description: 'Total number of matching items across all pages' },
      totalPages: { type: 'integer' },
      hasNextPage: { type: 'boolean' },
    },
  },
  BackupFile: {
    type: 'object',
    properties: {
      filename: { type: 'string', example: 'backup_2026-05-17_010000.sql' },
      generatedAt: { type: 'string', example: '2026-05-17 01:00:00' },
      type: { type: 'string', enum: ['full', 'incremental'] },
      since: { type: 'string', nullable: true, example: '2026-05-16 01:00:00', description: 'Start of the incremental window. Null for full backups.' },
      sizeKb: { type: 'integer', example: 12 },
      rows: { type: 'integer', nullable: true, example: 42, description: 'Number of data rows captured.' },
    },
  },
  RestoreResult: {
    type: 'object',
    properties: {
      filename: { type: 'string', example: 'backup_2026-05-17_010000.sql' },
      appliedStatements: { type: 'integer', example: 15, description: 'Number of SQL statements executed.' },
    },
  },
  Error: {
    type: 'object',
    properties: { message: { type: 'string' } },
  },
  ValidationError: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      error: { type: 'array', items: { type: 'string' } },
    },
  },
  Tag: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  TagWithUsage: {
    allOf: [
      ref('Tag'),
      {
        type: 'object',
        properties: {
          usage: {
            type: 'object',
            description: 'Number of active records using the tag',
            properties: {
              transactions: { type: 'integer' },
              invoices: { type: 'integer' },
              contracts: { type: 'integer' },
            },
          },
        },
      },
    ],
  },
  TagDuplicateGroup: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Normalized name shared by the tags in the group' },
      tags: { type: 'array', items: ref('TagWithUsage'), description: 'Most used first (suggested merge target)' },
    },
  },
  TagMergeResult: {
    type: 'object',
    properties: {
      tag: ref('TagWithUsage'),
      mergedIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    },
  },
  TagList: paginated(ref('Tag')),
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      username: { type: 'string' },
      email: { type: 'string', format: 'email' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Session: {
    type: 'object',
    description: 'The refresh token is delivered as an httpOnly cookie, not in the response body.',
    properties: {
      token: { type: 'string', description: 'Short-lived access token (JWT)' },
      user: ref('User'),
    },
  },
  Transaction: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Stable transaction identifier — use this in all URLs',
      },
      versionId: {
        type: 'string',
        format: 'uuid',
        description: 'Current version row id — use in restore endpoint',
      },
      version: { type: 'integer', minimum: 1 },
      date: { type: 'string', format: 'date-time' },
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', description: 'ISO 4217 currency code' },
        },
      },
      description: { type: 'string' },
      type: { type: 'string', enum: ['income', 'outcome'] },
      walletId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Wallet this transaction is linked to. Same as `wallet.id`; prefer `wallet`',
      },
      wallet,
      notes,
      invoice: {
        type: 'object',
        nullable: true,
        description: 'Invoice this transaction is linked to, if any',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['payable', 'receivable'] },
          status: { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] },
          total: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
            },
          },
        },
      },
      tags: { type: 'array', items: ref('Tag') },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  TransactionWithHistory: {
    allOf: [
      ref('Transaction'),
      {
        type: 'object',
        properties: {
          history: {
            type: 'array',
            description: 'Up to 5 most recent previous versions',
            items: ref('Transaction'),
          },
        },
      },
    ],
  },
  TransactionHistory: paginated(ref('Transaction')),
  WalletSnapshot: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', description: 'Absolute balance after this snapshot' },
      delta: { type: 'number', description: 'Signed change that produced this snapshot' },
      source: { type: 'string', enum: ['manual', 'transaction'] },
      transactionId: { type: 'string', format: 'uuid', nullable: true },
      recordedAt: { type: 'string', format: 'date-time', description: 'When the entry was recorded' },
      effectiveAt: {
        type: 'string',
        format: 'date-time',
        description: "When the change counts towards the balance: the transaction's date, or the adjustment date",
      },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  BalanceSeries: {
    type: 'object',
    properties: {
      interval: { type: 'string', enum: ['day', 'week', 'month'] },
      timezone: { type: 'string', description: 'Time zone the periods were cut in' },
      buckets: {
        type: 'array',
        items: { type: 'string', format: 'date' },
        description: 'First day of every period in the range, including periods with no activity',
      },
      series: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            walletId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            currency: { type: 'string' },
            openingBalance: { type: 'number', description: 'Balance just before startDate' },
            balances: {
              type: 'array',
              items: { type: 'number' },
              description: 'Balance at the end of each period, aligned with buckets',
            },
          },
        },
      },
      total: {
        type: 'array',
        items: { type: 'number' },
        nullable: true,
        description: 'Sum of all series per period; null when the wallets have different currencies',
      },
    },
  },
  WalletSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      currency: { type: 'string', description: 'ISO 4217 currency code' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  Wallet: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      currency: { type: 'string', description: 'ISO 4217 currency code' },
      currentBalance: { type: 'number' },
      position: { type: 'integer', description: 'Display order — lower is first' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  WalletWithHistory: {
    allOf: [
      ref('Wallet'),
      {
        type: 'object',
        properties: {
          recentSnapshots: {
            type: 'array',
            description: 'Up to 10 most recent balance snapshots',
            items: ref('WalletSnapshot'),
          },
        },
      },
    ],
  },
  TransactionSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      versionId: { type: 'string', format: 'uuid' },
      date: { type: 'string', format: 'date-time' },
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      walletId: { type: 'string', format: 'uuid', nullable: true, description: 'Same as `wallet.id`; prefer `wallet`' },
      wallet,
      type: { type: 'string', enum: ['income', 'outcome'] },
      description: { type: 'string' },
      notes,
      tags: { type: 'array', items: ref('Tag') },
    },
  },
  TransactionMonthlySummary: {
    type: 'object',
    properties: {
      currency: { type: 'string', description: 'ISO 4217 currency code' },
      month: { type: 'integer', minimum: 1, maximum: 12 },
      year: { type: 'integer' },
      lastMonthBalance: {
        type: 'number',
        description: 'Cumulative balance of all transactions up to the end of the previous month',
      },
      income: { type: 'number', description: 'Sum of income transactions in the selected month' },
      outcome: { type: 'number', description: 'Sum of outcome transactions in the selected month' },
      balance: { type: 'number', description: 'income − outcome for the month' },
      availableBalance: {
        type: 'number',
        description: 'lastMonthBalance + balance',
      },
    },
  },
  Invoice: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['payable', 'receivable'] },
      status: { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] },
      isOverdue: { type: 'boolean' },
      contact: { $ref: '#/components/schemas/Contact' },
      walletId: { type: 'string', format: 'uuid', nullable: true, description: 'Same as `wallet.id`; prefer `wallet`' },
      wallet,
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      paidAmount: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      issueDate: { type: 'string', format: 'date-time' },
      dueDate: { type: 'string', format: 'date-time' },
      description: { type: 'string', nullable: true },
      notes,
      tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
      history: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              enum: [
                'created',
                'transaction_added',
                'transaction_removed',
                'transaction_updated',
                'mark_paid',
                'mark_unpaid',
                'updated',
                'cancelled',
                'restored',
              ],
            },
            at: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] },
            paidAmount: { type: 'number', nullable: true },
            transactionId: { type: 'string', format: 'uuid', nullable: true },
            transactionAmount: { type: 'number', nullable: true },
            changes: { type: 'object', nullable: true },
            reason: {
              type: 'string',
              nullable: true,
              description: 'Reason given when the invoice was cancelled or restored',
            },
          },
        },
      },
      contractId: { type: 'string', format: 'uuid', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
      projected: { type: 'boolean', description: 'Present only when forecast=true. false for real DB invoices.' },
    },
  },
  ProjectedInvoice: {
    type: 'object',
    description: 'A virtual invoice projected from an active contract. Returned only when forecast=true.',
    properties: {
      projected: { type: 'boolean', enum: [true] },
      contractId: { type: 'string', format: 'uuid' },
      contact: { $ref: '#/components/schemas/Contact' },
      walletId: { type: 'string', format: 'uuid', nullable: true, description: 'Same as `wallet.id`; prefer `wallet`' },
      wallet,
      type: { type: 'string', enum: ['payable', 'receivable'] },
      status: { type: 'string', enum: ['projected'] },
      isOverdue: { type: 'boolean', enum: [false] },
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      paidAmount: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      dueDate: { type: 'string', format: 'date-time' },
      issueDate: { type: 'string', format: 'date-time', nullable: true },
      description: { type: 'string', nullable: true },
      tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
      history: { type: 'array', maxItems: 0 },
    },
  },
  InvoiceWithTransactions: {
    allOf: [
      { $ref: '#/components/schemas/Invoice' },
      {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/TransactionSummary' },
          },
        },
      },
    ],
  },
  Contact: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      document: { type: 'string', nullable: true },
      email: { type: 'string', format: 'email', nullable: true },
      phone: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  ContactList: paginated(ref('Contact')),
  ContractInvoiceSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'partial', 'paid', 'cancelled'] },
      dueDate: { type: 'string', format: 'date-time' },
      issueDate: { type: 'string', format: 'date-time' },
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      paidAmount: money('Sum of the payments (non-deleted transactions) linked to the invoice'),
      outstanding: money('Amount still owed: total minus paidAmount, never negative, and 0 when the invoice is marked paid'),
    },
  },
  Contract: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      type: { type: 'string', enum: ['payable', 'receivable'] },
      status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
      contact: { $ref: '#/components/schemas/Contact' },
      walletId: { type: 'string', format: 'uuid', nullable: true, description: 'Same as `wallet.id`; prefer `wallet`' },
      wallet,
      total: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Per-instalment invoice amount' },
          currency: { type: 'string', description: 'ISO 4217 currency code' },
        },
      },
      description: { type: 'string' },
      notes,
      tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
      instalments: { type: 'integer', minimum: 0, description: '0 = infinite/recurrent' },
      instalmentsDone: { type: 'integer', minimum: 0, description: 'Number of invoices generated so far' },
      cycleMonths: { type: 'integer', minimum: 1, maximum: 12, description: 'Interval between invoices in months' },
      firstDueDate: { type: 'string', format: 'date-time' },
      nextDueDate: { type: 'string', format: 'date-time', description: 'When the next invoice will be generated' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  ContractWithInvoices: {
    allOf: [
      { $ref: '#/components/schemas/Contract' },
      {
        type: 'object',
        properties: {
          invoices: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContractInvoiceSummary' },
          },
          totalInvoiced: money(
            'Sum of the non-deleted invoices, in the contract currency (invoices in another currency are left out)',
          ),
          totalPaid: money('Sum of paidAmount over the same invoices'),
          totalOutstanding: money('Sum of outstanding over the same invoices'),
        },
      },
    ],
  },
  WalletHistory: paginated(ref('WalletSnapshot')),
};
