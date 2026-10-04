import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, SessionResponseDto } from './global/setupTests';
import app from '../src/app';

let session: SessionResponseDto;

const buildTransactionPayload = (overrides?: object) => ({
  date: faker.date.recent().toISOString(),
  total: parseFloat(faker.finance.amount({ min: 10, max: 1000 })),
  currency: 'BRL',
  description: faker.lorem.sentence(),
  type: 'income',
  ...overrides,
});

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

describe('Transactions', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const response = await request(app).get('/api/transactions');
      expect(response.status).toEqual(401);
    });
  });

  describe('Pagination info', () => {
    it('should return the page info with the list', async () => {
      const auth = () => ({ Authorization: `Bearer ${session.token}` });
      const marker = `pagination-${faker.string.alphanumeric(10)}`;
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/transactions').set(auth()).send(buildTransactionPayload({ description: `${marker} ${i}` }));
      }

      const { body: first } = await request(app).get(`/api/transactions?description=${marker}&limit=2`).set(auth());
      expect(first.data).toHaveLength(2);
      expect(first.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });

      const { body: last } = await request(app).get(`/api/transactions?description=${marker}&limit=2&page=2`).set(auth());
      expect(last.data).toHaveLength(1);
      expect(last.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2, hasNextPage: false });
    });

    it('should report an empty list with no pages', async () => {
      const { body } = await request(app)
        .get(`/api/transactions?description=no-match-${faker.string.alphanumeric(12)}`)
        .set({ Authorization: `Bearer ${session.token}` });
      expect(body).toEqual({ data: [], pagination: { page: 1, limit: expect.any(Number), total: 0, totalPages: 0, hasNextPage: false } });
    });
  });

  describe('Versioning lifecycle', () => {
    let transactionId: string;
    let versionId: string;
    let v1VersionId: string;
    let tag1Name: string;
    let tag2Name: string;

    beforeAll(() => {
      tag1Name = faker.word.noun();
      tag2Name = faker.word.noun();
    });

    it('should create a transaction (v1) and return version metadata', async () => {
      const payload = buildTransactionPayload({ tags: [tag1Name] });

      const { body, status } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(payload);

      expect(status).toEqual(200);
      expect(body.version).toEqual(1);
      expect(body.id).toBeDefined();
      expect(body.versionId).toBeDefined();
      expect(body.id).toEqual(body.versionId); // first version: stable id === row id
      expect(body.tags).toHaveLength(1);
      expect(body.tags[0].name).toEqual(tag1Name);

      transactionId = body.id;
      versionId = body.versionId;
      v1VersionId = body.versionId;
    });

    it('should list transactions showing only the latest version', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      const found = body.find((t: { id: string }) => t.id === transactionId);
      expect(found).toBeDefined();
      expect(found.version).toEqual(1);
    });

    it('should get a transaction with empty history on first version', async () => {
      const { body, status } = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.id).toEqual(transactionId);
      expect(body.version).toEqual(1);
      expect(body.history).toEqual([]);
    });

    it('should update a transaction creating v2 and soft-deleting v1', async () => {
      const updatedDescription = faker.lorem.sentence();

      const { body, status } = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send(
          buildTransactionPayload({ description: updatedDescription, tags: [tag1Name, tag2Name] }),
        );

      expect(status).toEqual(200);
      expect(body.id).toEqual(transactionId); // stable id unchanged
      expect(body.version).toEqual(2);
      expect(body.versionId).not.toEqual(v1VersionId); // new row
      expect(body.description).toEqual(updatedDescription);
      expect(body.tags).toHaveLength(2);

      versionId = body.versionId;
    });

    it('should list transactions still showing one entry (latest v2)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      const matches = body.filter((t: { id: string }) => t.id === transactionId);
      expect(matches).toHaveLength(1);
      expect(matches[0].version).toEqual(2);
    });

    it('should get transaction showing v2 as current and v1 in history', async () => {
      const { body, status } = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.version).toEqual(2);
      expect(body.history).toHaveLength(1);
      expect(body.history[0].version).toEqual(1);
      expect(body.history[0].versionId).toEqual(v1VersionId);
      expect(body.history[0].tags).toHaveLength(1);
    });

    it('should update again creating v3', async () => {
      const { body, status } = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload({ type: 'outcome', tags: [] }));

      expect(status).toEqual(200);
      expect(body.version).toEqual(3);
      expect(body.id).toEqual(transactionId);
    });

    it('should get history with all 3 versions paginated', async () => {
      const { body, status } = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.pagination.total).toEqual(3);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].version).toEqual(3); // most recent first
      expect(body.data[1].version).toEqual(2);
      expect(body.data[2].version).toEqual(1);
    });

    it('should get history page 2 with limit 2', async () => {
      const { body, status } = await request(app)
        .get(`/api/transactions/${transactionId}/history?page=2&limit=2`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].version).toEqual(1);
      expect(body.pagination.page).toEqual(2);
      expect(body.pagination.limit).toEqual(2);
    });

    it('should restore to v1 creating v4 with v1 data and tags', async () => {
      const { body, status } = await request(app)
        .post(`/api/transactions/${transactionId}/restore/${v1VersionId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.version).toEqual(4);
      expect(body.id).toEqual(transactionId);
      expect(body.tags).toHaveLength(1);
      expect(body.tags[0].name).toEqual(tag1Name);
      expect(body.type).toEqual('income'); // v1 data
    });

    it('should have 4 versions in history after restore', async () => {
      const { body, status } = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.pagination.total).toEqual(4);
    });

    it('v1 through v3 must remain intact in history (restore did not modify them)', async () => {
      const { body } = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      const versions = body.data as Array<{ version: number; versionId: string }>;
      expect(versions.find((v) => v.version === 1)?.versionId).toEqual(v1VersionId);
    });

    it('should soft-delete all versions and hide transaction from list', async () => {
      const { status } = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);

      const { body: { data: body } } = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`);

      const found = body.find((t: { id: string }) => t.id === transactionId);
      expect(found).toBeUndefined();
    });

    it('should hard-delete all versions permanently', async () => {
      // Create a fresh transaction to hard-delete
      const { body: created } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      const freshId = created.id;

      // Update once to have 2 versions
      await request(app)
        .put(`/api/transactions/${freshId}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      // Hard delete
      const { status } = await request(app)
        .delete(`/api/transactions/${freshId}/remove`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);

      // History should return 404
      const { status: historyStatus } = await request(app)
        .get(`/api/transactions/${freshId}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(historyStatus).toEqual(404);
    });

    it('should hard-delete all versions after a prior soft-delete', async () => {
      const { body: created } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      const freshId = created.id;

      // Update once to have 2 versions
      await request(app)
        .put(`/api/transactions/${freshId}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      // Soft-delete first
      await request(app)
        .delete(`/api/transactions/${freshId}`)
        .set('Authorization', `Bearer ${session.token}`);

      // Hard delete
      const { status } = await request(app)
        .delete(`/api/transactions/${freshId}/remove`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);

      // History should return 404
      const { status: historyStatus } = await request(app)
        .get(`/api/transactions/${freshId}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(historyStatus).toEqual(404);
    });
  });

  describe('Validation', () => {
    it('should return 400 creating a transaction with invalid currency', async () => {
      const { status, body } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload({ currency: 'INVALID' }));

      expect(status).toEqual(400);
      expect(body.message).toEqual('Validation error');
    });

    it('should return 404 getting a non-existent transaction', async () => {
      const { status } = await request(app)
        .get('/api/transactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(404);
    });

    it('should return 404 restoring a version that does not exist', async () => {
      const { body: created } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      const { status } = await request(app)
        .post(`/api/transactions/${created.id}/restore/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(404);
    });

    it('should restore a soft-deleted transaction', async () => {
      const { body: created } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildTransactionPayload());

      await request(app)
        .delete(`/api/transactions/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      const { body, status } = await request(app)
        .post(`/api/transactions/${created.id}/restore/${created.versionId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.version).toEqual(2);
    });
  });

  describe('Search / filters', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    beforeAll(async () => {
      await Promise.all([
        request(app)
          .post('/api/transactions')
          .set(auth())
          .send(
            buildTransactionPayload({
              description: 'groceries at supermarket',
              type: 'outcome',
              tags: ['food', 'daily'],
            }),
          ),
        request(app)
          .post('/api/transactions')
          .set(auth())
          .send(
            buildTransactionPayload({
              description: 'travel to majorca',
              type: 'outcome',
              tags: ['travel', 'holiday'],
            }),
          ),
        request(app)
          .post('/api/transactions')
          .set(auth())
          .send(
            buildTransactionPayload({
              description: 'monthly salary',
              type: 'income',
              tags: ['salary'],
            }),
          ),
      ]);
    });

    it('should filter by description (partial, case-insensitive)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions?description=SUPER')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.every((t: any) => t.description.toLowerCase().includes('super'))).toBe(true);
    });

    it('should return empty array when description matches nothing', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions?description=zzznomatch')
        .set(auth());

      expect(status).toEqual(200);
      expect(body).toEqual([]);
    });

    it('should filter by a single tag (partial match)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions?filterByTag=travel')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.every((t: any) => t.tags.some((tag: any) => tag.name.includes('travel')))).toBe(
        true,
      );
    });

    it('should apply AND logic across multiple filterByTag terms', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions?filterByTag=travel&filterByTag=holiday')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(
        body.every(
          (t: any) =>
            t.tags.some((tag: any) => tag.name.includes('travel')) &&
            t.tags.some((tag: any) => tag.name.includes('holiday')),
        ),
      ).toBe(true);
    });

    it('should return empty array when AND tag combination matches nothing', async () => {
      const { body: { data: body } } = await request(app)
        .get('/api/transactions?filterByTag=food&filterByTag=travel')
        .set(auth());

      expect(body).toEqual([]);
    });

    it('should combine description and tag filters (AND)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions?description=groceries&filterByTag=food')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.every((t: any) => t.description.toLowerCase().includes('groceries'))).toBe(true);
      expect(body.every((t: any) => t.tags.some((tag: any) => tag.name.includes('food')))).toBe(
        true,
      );
    });

    it('should combine description filter with filterByType', async () => {
      const { body: { data: body } } = await request(app)
        .get('/api/transactions?description=salary&filterByType=outcome')
        .set(auth());

      expect(body).toEqual([]);
    });
  });

  describe('List deleted', () => {
    const authHeader = () => ({ Authorization: `Bearer ${session.token}` });

    it('should return soft-deleted transactions when deleted=true', async () => {
      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload());
      await request(app).delete(`/api/transactions/${tx.id}`).set(authHeader());

      const { body: { data: body }, status } = await request(app).get('/api/transactions?deleted=true').set(authHeader());
      expect(status).toEqual(200);
      expect(body.find((t: any) => t.id === tx.id)).toBeDefined();
    });

    it('should not return soft-deleted transactions in the default list', async () => {
      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload());
      await request(app).delete(`/api/transactions/${tx.id}`).set(authHeader());

      const { body: { data: body } } = await request(app).get('/api/transactions').set(authHeader());
      expect(body.every((t: any) => t.id !== tx.id)).toBe(true);
    });

    it('should not return active transactions when deleted=true', async () => {
      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload());

      const { body: { data: body } } = await request(app).get('/api/transactions?deleted=true').set(authHeader());
      expect(body.every((t: any) => t.id !== tx.id)).toBe(true);
    });

    it('should return only the latest version when deleted after an update', async () => {
      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v1 desc' }));

      const { body: v2 } = await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v2 desc' }));

      await request(app).delete(`/api/transactions/${v1.id}`).set(authHeader());

      const { body: { data: body } } = await request(app).get('/api/transactions?deleted=true').set(authHeader());
      const matches = body.filter((t: any) => t.id === v1.id);
      expect(matches).toHaveLength(1);
      expect(matches[0].description).toEqual('v2 desc');
      expect(matches[0].version).toEqual(v2.version);
    });
  });

  describe('Get deleted', () => {
    const authHeader = () => ({ Authorization: `Bearer ${session.token}` });

    it('should return the latest version of a soft-deleted transaction with its history when deleted=true', async () => {
      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v1 desc' }));
      const { body: v2 } = await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v2 desc' }));
      await request(app).delete(`/api/transactions/${v1.id}`).set(authHeader());

      const { body, status } = await request(app).get(`/api/transactions/${v1.id}?deleted=true`).set(authHeader());
      expect(status).toEqual(200);
      expect(body.id).toEqual(v1.id);
      expect(body.version).toEqual(v2.version);
      expect(body.description).toEqual('v2 desc');
      expect(body.deletedAt).toBeDefined();
      expect(body.history).toHaveLength(1);
      expect(body.history[0].description).toEqual('v1 desc');
    });

    it('should return 404 for a soft-deleted transaction without deleted=true', async () => {
      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload());
      await request(app).delete(`/api/transactions/${tx.id}`).set(authHeader());

      const { status } = await request(app).get(`/api/transactions/${tx.id}`).set(authHeader());
      expect(status).toEqual(404);
    });

    it('should return the active version of a transaction when deleted=true', async () => {
      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v1 desc' }));
      await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(authHeader())
        .send(buildTransactionPayload({ description: 'v2 desc' }));

      const { body, status } = await request(app).get(`/api/transactions/${v1.id}?deleted=true`).set(authHeader());
      expect(status).toEqual(200);
      expect(body.description).toEqual('v2 desc');
      expect(body.deletedAt).toBeUndefined();
    });
  });

  describe('Summary', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    beforeAll(async () => {
      await Promise.all([
        request(app).post('/api/transactions').set(auth()).send({
          date: '2020-01-10T12:00:00.000Z',
          total: 100,
          currency: 'BRL',
          description: 'summary test income 1',
          type: 'income',
        }),
        request(app).post('/api/transactions').set(auth()).send({
          date: '2020-01-20T12:00:00.000Z',
          total: 200,
          currency: 'BRL',
          description: 'summary test income 2',
          type: 'income',
        }),
        request(app).post('/api/transactions').set(auth()).send({
          date: '2020-01-15T12:00:00.000Z',
          total: 50,
          currency: 'BRL',
          description: 'summary test outcome 1',
          type: 'outcome',
        }),
        request(app).post('/api/transactions').set(auth()).send({
          date: '2019-12-15T12:00:00.000Z',
          total: 1000,
          currency: 'BRL',
          description: 'summary test prior income',
          type: 'income',
        }),
      ]);
    });

    it('should return 401 without a token', async () => {
      const { status } = await request(app).get('/api/transactions/summary?month=1&year=2020&currency=BRL');
      expect(status).toEqual(401);
    });

    it('should return 400 when currency is missing', async () => {
      const { status, body } = await request(app)
        .get('/api/transactions/summary?month=1&year=2020')
        .set(auth());
      expect(status).toEqual(400);
      expect(body.message).toEqual('Validation error');
    });

    it('should return 400 when currency is invalid', async () => {
      const { status } = await request(app)
        .get('/api/transactions/summary?month=1&year=2020&currency=INVALID')
        .set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 when month is out of range', async () => {
      const { status } = await request(app)
        .get('/api/transactions/summary?month=13&year=2020&currency=BRL')
        .set(auth());
      expect(status).toEqual(400);
    });

    it('should return correct summary for Jan 2020', async () => {
      const { status, body } = await request(app)
        .get('/api/transactions/summary?month=1&year=2020&currency=BRL')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.currency).toEqual('BRL');
      expect(body.month).toEqual(1);
      expect(body.year).toEqual(2020);
      expect(body.income).toEqual(300);
      expect(body.outcome).toEqual(50);
      expect(body.balance).toEqual(250);
      expect(body.lastMonthBalance).toEqual(1000);
      expect(body.availableBalance).toEqual(1250);
    });

    it('should return zero income/outcome for a month with no transactions and lastMonthBalance from history', async () => {
      const { status, body } = await request(app)
        .get('/api/transactions/summary?month=6&year=2020&currency=BRL')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.income).toEqual(0);
      expect(body.outcome).toEqual(0);
      expect(body.balance).toEqual(0);
      // cumulative through May 2020: 1000 + 100 + 200 - 50 = 1250
      expect(body.lastMonthBalance).toEqual(1250);
      expect(body.availableBalance).toEqual(1250);
    });

    it('should not include soft-deleted transactions in the summary', async () => {
      const { body: created } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({
          date: '2020-01-25T12:00:00.000Z',
          total: 9999,
          currency: 'BRL',
          description: 'summary test deleted income',
          type: 'income',
        });

      await request(app).delete(`/api/transactions/${created.id}`).set(auth());

      const { body } = await request(app)
        .get('/api/transactions/summary?month=1&year=2020&currency=BRL')
        .set(auth());

      expect(body.income).toEqual(300);
    });
  });

  describe('Invoice field in transaction response', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    it('should include invoice summary when transaction is linked to an invoice', async () => {
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send({
        contactId: contact.id,
        type: 'payable',
        amount: 500,
        currency: 'BRL',
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'invoice for tx test',
      });

      const { body: added } = await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send({
        date: new Date().toISOString(),
        total: 250,
        currency: 'BRL',
        description: 'partial payment',
      });

      const txId = added.transactions[0].id;
      const { body: tx, status } = await request(app).get(`/api/transactions/${txId}`).set(auth());

      expect(status).toEqual(200);
      expect(tx.invoice).toMatchObject({
        id: invoice.id,
        type: 'payable',
        status: 'partial',
        total: { amount: 500, currency: 'BRL' },
      });
    });

    it('should have invoice: null for standalone transactions', async () => {
      const { body: tx } = await request(app).post('/api/transactions').set(auth()).send(buildTransactionPayload());

      const { body, status } = await request(app).get(`/api/transactions/${tx.id}`).set(auth());

      expect(status).toEqual(200);
      expect(body.invoice).toBeNull();
    });
  });

  describe('Wallet balance after restore', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    const createWallet = () =>
      request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: faker.finance.accountName(), currency: 'BRL' })
        .then((r) => r.body as { id: string; currentBalance: number });

    const getBalance = (walletId: string) =>
      request(app)
        .get(`/api/wallets/${walletId}`)
        .set(auth())
        .then((r) => r.body.currentBalance as number);

    it('should revert wallet balance when restoring to a previous version (same wallet)', async () => {
      const wallet = await createWallet();

      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ date: new Date().toISOString(), total: 100, description: 'v1', type: 'income', walletId: wallet.id });

      expect(await getBalance(wallet.id)).toEqual(100);

      await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ date: new Date().toISOString(), total: 200, description: 'v2', type: 'income', walletId: wallet.id });

      expect(await getBalance(wallet.id)).toEqual(200);

      await request(app)
        .post(`/api/transactions/${v1.id}/restore/${v1.versionId}`)
        .set(auth());

      expect(await getBalance(wallet.id)).toEqual(100);
    });

    it('should not double-reverse wallet balance when hard-deleting a previously soft-deleted transaction', async () => {
      const wallet = await createWallet();

      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ date: new Date().toISOString(), total: 100, description: 'v1', type: 'income', walletId: wallet.id });

      expect(await getBalance(wallet.id)).toEqual(100);

      // Soft-delete reverses the delta once → balance becomes 0
      await request(app).delete(`/api/transactions/${v1.id}`).set(auth());
      expect(await getBalance(wallet.id)).toEqual(0);

      // Hard-delete must NOT reverse the delta again → balance must stay 0, not go to -100
      await request(app).delete(`/api/transactions/${v1.id}/remove`).set(auth());
      expect(await getBalance(wallet.id)).toEqual(0);
    });

    it('should restore wallet balance when restoring a deleted transaction', async () => {
      const wallet = await createWallet();

      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ date: new Date().toISOString(), total: 100, description: 'v1', type: 'income', walletId: wallet.id });

      expect(await getBalance(wallet.id)).toEqual(100);

      await request(app).delete(`/api/transactions/${v1.id}`).set(auth());

      expect(await getBalance(wallet.id)).toEqual(0);

      await request(app)
        .post(`/api/transactions/${v1.id}/restore/${v1.versionId}`)
        .set(auth());

      expect(await getBalance(wallet.id)).toEqual(100);
    });
  });

  describe('Restore deleted', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    it('should restore a soft-deleted transaction with its latest version and wallet balance', async () => {
      // Unique, so the list lookup below doesn't depend on how many transactions other tests created
      const v2Description = `v2 ${faker.string.alphanumeric(12)}`;
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: faker.finance.accountName(), currency: 'BRL' });
      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ date: new Date().toISOString(), total: 100, description: 'v1', type: 'income', walletId: wallet.id });
      await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ date: new Date().toISOString(), total: 250, description: v2Description, type: 'income', walletId: wallet.id });
      await request(app).delete(`/api/transactions/${v1.id}`).set(auth());

      const { body: deletedWallet } = await request(app).get(`/api/wallets/${wallet.id}`).set(auth());
      expect(deletedWallet.currentBalance).toEqual(0);

      const { body, status } = await request(app).patch(`/api/transactions/${v1.id}/restore`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(v1.id);
      expect(body.description).toEqual(v2Description);
      expect(body.deletedAt).toBeUndefined();

      const { body: restoredWallet } = await request(app).get(`/api/wallets/${wallet.id}`).set(auth());
      expect(restoredWallet.currentBalance).toEqual(250);

      const { body: { data: list } } = await request(app).get(`/api/transactions?description=${v2Description}`).set(auth());
      expect(list.filter((t: any) => t.id === v1.id)).toHaveLength(1);
    });

    it('should return 400 when restoring a transaction that is not deleted', async () => {
      const { body: tx } = await request(app).post('/api/transactions').set(auth()).send(buildTransactionPayload());

      const { status } = await request(app).patch(`/api/transactions/${tx.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 404 when restoring an unknown transaction', async () => {
      const { status } = await request(app).patch(`/api/transactions/${faker.string.uuid()}/restore`).set(auth());
      expect(status).toEqual(404);
    });
  });
});

describe('Transactions — wallet, notes and search', () => {
  const auth = () => ({ Authorization: `Bearer ${session.token}` });

  const createWallet = async (name = `wallet-${faker.string.alphanumeric(10)}`) => {
    const { body } = await request(app).post('/api/wallets').set(auth()).send({ name, currency: 'BRL' });
    return body;
  };

  const createTransaction = async (overrides?: object) => {
    const { body } = await request(app).post('/api/transactions').set(auth()).send(buildTransactionPayload(overrides));
    return body;
  };

  // A wallet sets the currency, so the payload must not carry one
  const createWalletTransaction = async (walletId: string, overrides?: object) => {
    const { currency: _currency, ...payload } = buildTransactionPayload({ walletId, ...overrides });
    const { body } = await request(app).post('/api/transactions').set(auth()).send(payload);
    return body;
  };

  describe('Embedded wallet', () => {
    it('should embed the wallet and keep walletId', async () => {
      const wallet = await createWallet();
      const transaction = await createWalletTransaction(wallet.id);

      expect(transaction.walletId).toEqual(wallet.id);
      expect(transaction.wallet).toEqual({ id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: null });
    });

    it('should return wallet: null for a transaction without a wallet', async () => {
      const transaction = await createTransaction();
      expect(transaction.walletId).toBeNull();
      expect(transaction.wallet).toBeNull();
    });

    it('should still embed the wallet after it is soft-deleted, on list, detail and history', async () => {
      const wallet = await createWallet();
      const marker = `deleted-wallet-${faker.string.alphanumeric(10)}`;
      const transaction = await createWalletTransaction(wallet.id, { description: marker });

      await request(app).delete(`/api/wallets/${wallet.id}`).set(auth());

      const expected = { id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: expect.any(String) };

      const { body: detail } = await request(app).get(`/api/transactions/${transaction.id}`).set(auth());
      expect(detail.walletId).toEqual(wallet.id);
      expect(detail.wallet).toEqual(expected);

      const { body: list } = await request(app).get(`/api/transactions?description=${marker}`).set(auth());
      expect(list.data).toHaveLength(1);
      expect(list.data[0].walletId).toEqual(wallet.id);
      expect(list.data[0].wallet).toEqual(expected);

      const { body: history } = await request(app).get(`/api/transactions/${transaction.id}/history`).set(auth());
      expect(history.data[0].wallet).toEqual(expected);
    });
  });

  describe('Notes', () => {
    it('should create a transaction with notes and default to null without them', async () => {
      const withNotes = await createTransaction({ notes: 'paid in cash' });
      expect(withNotes.notes).toEqual('paid in cash');

      const withoutNotes = await createTransaction();
      expect(withoutNotes.notes).toBeNull();
    });

    it('should return 400 when notes are longer than 2000 characters', async () => {
      const { status } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send(buildTransactionPayload({ notes: 'a'.repeat(2001) }));
      expect(status).toEqual(400);
    });

    it('should copy notes into each version and restore them with a previous version', async () => {
      const withoutNotes = buildTransactionPayload();
      const payload = { ...withoutNotes, notes: 'first notes' };
      const { body: v1 } = await request(app).post('/api/transactions').set(auth()).send(payload);

      // Omitting notes keeps them
      const { body: v2 } = await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ ...withoutNotes, total: payload.total + 1 });
      expect(v2.version).toEqual(2);
      expect(v2.notes).toEqual('first notes');

      const { body: v3 } = await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ ...payload, notes: 'second notes' });
      expect(v3.notes).toEqual('second notes');

      const { body: detail } = await request(app).get(`/api/transactions/${v1.id}`).set(auth());
      expect(detail.notes).toEqual('second notes');
      expect(detail.history.map((v: any) => v.notes)).toEqual(['first notes', 'first notes']);

      const { body: restored } = await request(app)
        .post(`/api/transactions/${v1.id}/restore/${v1.versionId}`)
        .set(auth());
      expect(restored.version).toEqual(4);
      expect(restored.notes).toEqual('first notes');

      const { body: cleared } = await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ ...payload, notes: null });
      expect(cleared.notes).toBeNull();
    });
  });

  describe('General search', () => {
    const marker = faker.string.alphanumeric(10).toLowerCase();
    const walletName = `searchwallet${marker}`;
    let byDescription: any;
    let byNotes: any;
    let byWallet: any;
    let byTag: any;

    beforeAll(async () => {
      const wallet = await createWallet(walletName);
      byDescription = await createTransaction({ description: `rent ${marker}` });
      byNotes = await createTransaction({ description: 'something else', notes: `receipt ${marker}` });
      byWallet = await createWalletTransaction(wallet.id);
      byTag = await createTransaction({ tags: [`tag${marker}`] });
    });

    it('should match description, notes, wallet name and tag names', async () => {
      const { body, status } = await request(app).get(`/api/transactions?search=${marker}`).set(auth());

      expect(status).toEqual(200);
      expect(body.data.map((t: any) => t.id).sort()).toEqual(
        [byDescription.id, byNotes.id, byWallet.id, byTag.id].sort(),
      );
    });

    it('should be case-insensitive', async () => {
      const { body } = await request(app).get(`/api/transactions?search=${walletName.toUpperCase()}`).set(auth());
      expect(body.data.map((t: any) => t.id)).toEqual([byWallet.id]);
    });

    it('should match the name of a soft-deleted wallet', async () => {
      const wallet = await createWallet(`gonewallet${marker}`);
      const transaction = await createWalletTransaction(wallet.id);
      await request(app).delete(`/api/wallets/${wallet.id}`).set(auth());

      const { body } = await request(app).get(`/api/transactions?search=gonewallet${marker}`).set(auth());
      expect(body.data.map((t: any) => t.id)).toEqual([transaction.id]);
    });

    it('should return an empty list when nothing matches', async () => {
      const { body } = await request(app).get(`/api/transactions?search=nomatch${marker}`).set(auth());
      expect(body.data).toEqual([]);
    });

    it('should keep the description filter working', async () => {
      const { body } = await request(app).get(`/api/transactions?description=${marker}`).set(auth());
      expect(body.data.map((t: any) => t.id)).toEqual([byDescription.id]);
    });
  });

  describe('Filter by tag id', () => {
    const marker = faker.string.alphanumeric(10).toLowerCase();
    let exact: any;
    let partial: any;
    let both: any;

    beforeAll(async () => {
      exact = await createTransaction({ tags: [`food${marker}`] });
      partial = await createTransaction({ tags: [`sea food${marker}`] });
      both = await createTransaction({ tags: [`food${marker}`, `extra${marker}`] });
    });

    it('should match the tag name partially with filterByTag', async () => {
      const { body } = await request(app).get(`/api/transactions?filterByTag=food${marker}`).set(auth());
      expect(body.data.map((t: any) => t.id).sort()).toEqual([exact.id, partial.id, both.id].sort());
    });

    it('should match only the exact tag with filterByTagId', async () => {
      const tagId = exact.tags[0].id;
      const { body, status } = await request(app).get(`/api/transactions?filterByTagId=${tagId}`).set(auth());

      expect(status).toEqual(200);
      expect(body.data.map((t: any) => t.id).sort()).toEqual([exact.id, both.id].sort());
    });

    it('should apply AND logic across repeated filterByTagId', async () => {
      const foodId = exact.tags[0].id;
      const extraId = both.tags.find((t: any) => t.name === `extra${marker}`).id;
      const { body } = await request(app)
        .get(`/api/transactions?filterByTagId=${foodId}&filterByTagId=${extraId}`)
        .set(auth());
      expect(body.data.map((t: any) => t.id)).toEqual([both.id]);
    });

    it('should return 400 for an invalid tag id', async () => {
      const { status } = await request(app).get('/api/transactions?filterByTagId=not-a-uuid').set(auth());
      expect(status).toEqual(400);
    });
  });
});
