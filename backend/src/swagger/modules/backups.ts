import { jsonResponse, ref, security, r } from '../helpers';

const filenameParam = {
  name: 'filename',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', example: 'backup_2026-05-17_010000.sql' },
  description: 'Backup filename (must match backup_YYYY-MM-DD_HHMMSS.sql)',
};

export const backupsPaths = {
  '/api/backups': {
    get: {
      tags: ['Backups'],
      summary: 'List backups',
      description: 'Returns all backup files for the authenticated user, newest first.',
      security,
      responses: {
        200: jsonResponse({
          type: 'array',
          items: ref('BackupFile'),
        }),
        401: r[401],
      },
    },
  },
  '/api/backups/{filename}/restore': {
    post: {
      tags: ['Backups'],
      summary: 'Restore a backup',
      description:
        'Returns all of the authenticated user\'s data (wallets, tags, contacts, contracts, invoices, transactions) ' +
        'to exactly the state of the backup: current data is removed and the backup is loaded in a single DB transaction. ' +
        'The user account itself (e.g. password) is not changed. Only full backups of the authenticated user can be restored; ' +
        'older incremental files are rejected with 400.',
      security,
      parameters: [filenameParam],
      responses: {
        200: jsonResponse(ref('RestoreResult')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
