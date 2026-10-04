import { schemas } from './schemas';
import { sessionsPaths } from './modules/sessions';
import { usersPaths } from './modules/users';
import { setupPaths } from './modules/setup';
import { transactionsPaths } from './modules/transactions';
import { tagsPaths } from './modules/tags';
import { walletsPaths } from './modules/wallets';
import { contactsPaths } from './modules/contacts';
import { invoicesPaths } from './modules/invoices';
import { contractsPaths } from './modules/contracts';
import { backupsPaths } from './modules/backups';

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Controle Caixa API',
    version: '1.0.0',
    description:
      'Cash flow management REST API. All endpoints under /transactions, /tags, and /wallets require authentication. Use the Login endpoint to obtain a Bearer token.',
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  tags: [
    { name: 'Sessions', description: 'Authentication — login, refresh, logout' },
    { name: 'Users', description: 'User management' },
    { name: 'Setup', description: 'First access: create the first account' },
    { name: 'Transactions', description: 'Cash flow transactions with full version history' },
    { name: 'Tags', description: 'User-scoped transaction tags' },
    {
      name: 'Wallets',
      description: 'Bank accounts, cash, and investment wallets with balance history',
    },
    { name: 'Contacts', description: 'Customers and providers' },
    { name: 'Invoices', description: 'Payables and receivables linked to contacts' },
    { name: 'Contracts', description: 'Recurring billing templates that auto-generate invoices on a schedule' },
    { name: 'Backups', description: 'Per-user daily full backups, the last 5 are kept; restoring one returns the data to exactly that state' },
  ],
  paths: {
    ...sessionsPaths,
    ...usersPaths,
    ...setupPaths,
    ...transactionsPaths,
    ...tagsPaths,
    ...walletsPaths,
    ...contactsPaths,
    ...invoicesPaths,
    ...contractsPaths,
    ...backupsPaths,
  },
};

export { spec };
