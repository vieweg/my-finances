import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import {
  adminUserCredentials,
  SessionResponseDto,
  buildCreateUserPayload,
} from './global/setupTests';
import app from '../src/app';

let session: SessionResponseDto;
let contactId: string;

const auth = () => ({ Authorization: `Bearer ${session.token}` });

const buildPayload = (overrides?: object) => ({
  contactId,
  type: 'receivable',
  amount: 1000,
  currency: 'BRL',
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  description: faker.lorem.sentence(),
  ...overrides,
});

const buildTransactionPayload = (overrides?: object) => ({
  date: new Date().toISOString(),
  total: 500,
  currency: 'BRL',
  description: 'Partial payment',
  ...overrides,
});

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;

  const { body: contact } = await request(app)
    .post('/api/contacts')
    .set(auth())
    .send({ name: faker.person.fullName() });
  contactId = contact.id;
});

describe('Invoices', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toEqual(401);
    });
  });

  describe('CRUD', () => {
    it('should create an invoice', async () => {
      const payload = buildPayload();
      const { body, status } = await request(app).post('/api/invoices').set(auth()).send(payload);

      expect(status).toEqual(201);
      expect(body).toMatchObject({
        id: expect.any(String),
        type: 'receivable',
        status: 'pending',
        isOverdue: false,
        total: { amount: 1000, currency: 'BRL' },
        paidAmount: { amount: 0, currency: 'BRL' },
        contact: expect.objectContaining({ id: contactId }),
        history: expect.arrayContaining([
          expect.objectContaining({ event: 'created', status: 'pending' }),
        ]),
      });
    });

    it('should return 400 when dueDate is before issueDate', async () => {
      const { status } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(
          buildPayload({
            issueDate: new Date().toISOString(),
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          }),
        );
      expect(status).toEqual(400);
    });

    it('should return 404 when contact does not belong to user', async () => {
      const user2 = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user2);
      const { body: s2 } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { status } = await request(app)
        .post('/api/invoices')
        .set({ Authorization: `Bearer ${s2.token}` })
        .send(buildPayload());

      expect(status).toEqual(404);
    });

    it('should list invoices', async () => {
      const { body: { data: body }, status } = await request(app).get('/api/invoices').set(auth());
      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should get an invoice by id with transaction list', async () => {
      const { body: created } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());

      const { body, status } = await request(app).get(`/api/invoices/${created.id}`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(Array.isArray(body.transactions)).toBe(true);
    });

    it('should return 404 for non-existent invoice', async () => {
      const { status } = await request(app)
        .get('/api/invoices/00000000-0000-0000-0000-000000000000')
        .set(auth());
      expect(status).toEqual(404);
    });

    it('should update an invoice', async () => {
      const { body: created } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());

      const { body, status } = await request(app)
        .put(`/api/invoices/${created.id}`)
        .set(auth())
        .send({ amount: 2000 });

      expect(status).toEqual(200);
      expect(body.total).toEqual({ amount: 2000, currency: 'BRL' });
      expect(body.history).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'updated' })]),
      );
    });
  });

  describe('Filtering', () => {
    let filteredInvoiceId: string;
    let filterContactId: string;
    const uniqueDesc = 'UniqueDescFilter_Xyz789';

    beforeAll(async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send({ name: 'FilterableContact SpecialUser' });
      filterContactId = contact.id;

      const { body: inv } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ contactId: filterContactId, description: uniqueDesc }));
      filteredInvoiceId = inv.id;
    });

    it('should filter real invoices by description (partial match)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?description=UniqueDescFilter')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.some((i: any) => i.id === filteredInvoiceId)).toBe(true);
      expect(body.every((i: any) => i.description?.toLowerCase().includes('uniquedescfilter'))).toBe(true);
    });

    it('should return no results when description does not match', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?description=NOMATCH_DESCRIPTION_XYZ')
        .set(auth());

      expect(status).toEqual(200);
      expect(body).toHaveLength(0);
    });

    it('should filter real invoices by contact name (partial match)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?filterByContactName=FilterableContact')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.some((i: any) => i.id === filteredInvoiceId)).toBe(true);
      expect(body.every((i: any) => i.contact.name.toLowerCase().includes('filterablecontact'))).toBe(true);
    });

    it('should return no results when contact name does not match', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?filterByContactName=NoSuchContactXYZ')
        .set(auth());

      expect(status).toEqual(200);
      expect(body).toHaveLength(0);
    });

    it('should match real invoices by description via search (OR)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?search=UniqueDescFilter')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.some((i: any) => i.id === filteredInvoiceId)).toBe(true);
    });

    it('should match real invoices by contact name via search (OR)', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?search=FilterableContact')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.some((i: any) => i.id === filteredInvoiceId)).toBe(true);
    });

    it('should return no results when search matches neither description nor contact name', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/invoices?search=NOMATCH_SEARCH_XYZ')
        .set(auth());

      expect(status).toEqual(200);
      expect(body).toHaveLength(0);
    });
  });

  describe('Payments (addTransaction)', () => {
    it('should change status to partial when payment is less than amount', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body, status } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      expect(status).toEqual(201);
      expect(body.status).toEqual('partial');
      expect(body.paidAmount).toEqual({ amount: 500, currency: 'BRL' });
      expect(body.transactions).toHaveLength(1);
      expect(body.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'transaction_added', status: 'partial' }),
        ]),
      );
    });

    it('should change status to paid when payment covers the full amount', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body, status } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 1000 }));

      expect(status).toEqual(201);
      expect(body.status).toEqual('paid');
      expect(body.paidAmount).toEqual({ amount: 1000, currency: 'BRL' });
    });

    it('should accumulate multiple payments', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 300 }));
      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 400 }));
      const { body } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 300 }));

      expect(body.status).toEqual('paid');
      expect(body.paidAmount).toEqual({ amount: 1000, currency: 'BRL' });
      expect(body.transactions).toHaveLength(3);
    });

    it('should return 400 when adding a transaction to a paid invoice', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 500 }));
      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      const { status } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 100 }));

      expect(status).toEqual(400);
    });

    it('should return 400 when transaction currency does not match invoice currency', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { status, body } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ currency: 'USD' }));

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });

    it('should return 400 when wallet currency does not match invoice currency', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: 'USD wallet', currency: 'USD' });

      const { status, body } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ walletId: wallet.id, currency: undefined }));

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });

    it('transaction should inherit invoice tags', async () => {
      const { body: tag } = await request(app)
        .post('/api/tags')
        .set(auth())
        .send({ name: faker.word.noun() });
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ tags: [{ id: tag.id, name: tag.name }] }));

      const { body } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload());

      const { body: tx } = await request(app)
        .get(`/api/transactions/${body.transactions[0].id}`)
        .set(auth());

      expect(tx.tags).toEqual(expect.arrayContaining([expect.objectContaining({ id: tag.id })]));
    });
  });

  describe('Update transaction currency enforcement', () => {
    it('should return 400 when updating an invoice transaction with a different currency', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500, currency: 'BRL' }));

      const txId = added.transactions[0].id;

      const { status, body } = await request(app)
        .put(`/api/transactions/${txId}`)
        .set(auth())
        .send({ date: new Date().toISOString(), total: 500, currency: 'USD', description: 'update', type: 'income' });

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });

    it('should return 400 when updating an invoice transaction with a wallet of different currency', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500, currency: 'BRL' }));

      const { body: usdWallet } = await request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: 'USD wallet', currency: 'USD' });

      const txId = added.transactions[0].id;

      const { status, body } = await request(app)
        .put(`/api/transactions/${txId}`)
        .set(auth())
        .send({ date: new Date().toISOString(), total: 500, walletId: usdWallet.id, description: 'update', type: 'income' });

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });
  });

  describe('Mark as paid', () => {
    it('should force-mark a pending invoice as paid', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body, status } = await request(app)
        .patch(`/api/invoices/${invoice.id}/mark-paid`)
        .set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('paid');
      expect(body.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.history).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'mark_paid' })]),
      );
    });

    it('should force-mark a partial invoice as paid', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));
      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 400 }));

      const { body, status } = await request(app)
        .patch(`/api/invoices/${invoice.id}/mark-paid`)
        .set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('paid');
      expect(body.paidAmount).toEqual({ amount: 400, currency: 'BRL' });
    });

    it('should return 400 when already paid', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 500 }));
      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      const { status } = await request(app)
        .patch(`/api/invoices/${invoice.id}/mark-paid`)
        .set(auth());
      expect(status).toEqual(400);
    });
  });

  describe('Soft-delete (cancel)', () => {
    it('should soft-delete an invoice and mark it cancelled', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());

      const { body, status } = await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('cancelled');

      const { status: getStatus } = await request(app)
        .get(`/api/invoices/${invoice.id}`)
        .set(auth());
      expect(getStatus).toEqual(404);
    });

    it('should hard-delete an invoice via /remove', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());

      const { status } = await request(app)
        .delete(`/api/invoices/${invoice.id}/remove`)
        .set(auth());
      expect(status).toEqual(200);

      const { status: getStatus } = await request(app)
        .get(`/api/invoices/${invoice.id}`)
        .set(auth());
      expect(getStatus).toEqual(404);
    });

    it('should return 400 when adding a transaction to a cancelled invoice', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { status } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload());

      expect(status).toEqual(400);
    });
  });

  describe('Restore', () => {
    it('should restore a cancelled invoice as pending when no payments exist', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/invoices/${invoice.id}/restore`).set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('pending');
      expect(body.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.history).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'restored' })]));

      const { status: getStatus } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(getStatus).toEqual(200);
    });

    it('should restore a cancelled invoice as partial when partial payments exist', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 500 }));
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/invoices/${invoice.id}/restore`).set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('partial');
      expect(body.paidAmount).toEqual({ amount: 500, currency: 'BRL' });
    });

    it('should restore a cancelled invoice as paid when fully paid', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 500 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 500 }));
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/invoices/${invoice.id}/restore`).set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('paid');
      expect(body.paidAmount).toEqual({ amount: 500, currency: 'BRL' });
    });

    it('should return 404 when restoring an unknown invoice', async () => {
      const { status } = await request(app)
        .patch('/api/invoices/00000000-0000-0000-0000-000000000000/restore')
        .set(auth());
      expect(status).toEqual(404);
    });

    it('should return 400 when restoring an invoice that is not deleted', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());

      const { status } = await request(app).patch(`/api/invoices/${invoice.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });
  });

  describe('List deleted', () => {
    it('should return soft-deleted invoices when deleted=true', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body: { data: body }, status } = await request(app).get('/api/invoices?deleted=true').set(auth());
      expect(status).toEqual(200);
      expect(body.find((i: any) => i.id === invoice.id)).toBeDefined();
    });

    it('should not return soft-deleted invoices in the default list', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body: { data: body } } = await request(app).get('/api/invoices').set(auth());
      expect(body.every((i: any) => i.id !== invoice.id)).toBe(true);
    });

    it('should not return active invoices when deleted=true', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());

      const { body: { data: body } } = await request(app).get('/api/invoices?deleted=true').set(auth());
      expect(body.every((i: any) => i.id !== invoice.id)).toBe(true);
    });

    it('should return correct paidAmount for deleted invoices with payments', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 500 }));
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body: { data: body } } = await request(app).get('/api/invoices?deleted=true').set(auth());
      const found = body.find((i: any) => i.id === invoice.id);
      expect(found).toBeDefined();
      expect(found.paidAmount).toEqual({ amount: 500, currency: 'BRL' });
    });
  });

  describe('Get deleted', () => {
    it('should return a soft-deleted invoice with its payments when deleted=true', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 500 }));
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { body, status } = await request(app).get(`/api/invoices/${invoice.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(invoice.id);
      expect(body.deletedAt).toBeDefined();
      expect(body.paidAmount).toEqual({ amount: 500, currency: 'BRL' });
      expect(body.transactions).toHaveLength(1);
    });

    it('should return 404 for a soft-deleted invoice without deleted=true', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { status } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(status).toEqual(404);
    });

    it('should return an active invoice when deleted=true', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload());

      const { body, status } = await request(app).get(`/api/invoices/${invoice.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.deletedAt).toBeUndefined();
    });
  });

  describe('Invoice status after transaction delete', () => {
    it('should revert invoice from partial to pending when the only payment is soft-deleted', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      expect(added.status).toEqual('partial');

      await request(app)
        .delete(`/api/transactions/${added.transactions[0].id}`)
        .set(auth());

      const { body } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(body.status).toEqual('pending');
      expect(body.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.history).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'transaction_removed', status: 'pending' })]),
      );
    });

    it('should revert invoice from paid to partial when one of two payments is soft-deleted', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 600 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 400 }));

      expect(added.status).toEqual('paid');

      await request(app)
        .delete(`/api/transactions/${added.transactions[1].id}`)
        .set(auth());

      const { body } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(body.status).toEqual('partial');
      expect(body.paidAmount).toEqual({ amount: 600, currency: 'BRL' });
    });

    it('should revert invoice to pending when the only payment is hard-deleted', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      await request(app)
        .delete(`/api/transactions/${added.transactions[0].id}/remove`)
        .set(auth());

      const { body } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(body.status).toEqual('pending');
      expect(body.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
    });

    it('should not change a cancelled invoice status when a payment transaction is deleted', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500 }));

      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      // Deleting the transaction should not crash and should not affect the cancelled invoice
      const { status } = await request(app)
        .delete(`/api/transactions/${added.transactions[0].id}`)
        .set(auth());
      expect(status).toEqual(200);
    });
  });

  describe('Currency change restriction', () => {
    it('should return 400 when changing currency on an invoice with an active transaction', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500, currency: 'BRL' }));

      const { status, body } = await request(app)
        .put(`/api/invoices/${invoice.id}`)
        .set(auth())
        .send({ currency: 'USD' });

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });

    it('should return 400 when changing currency via wallet on an invoice with a soft-deleted transaction', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { body: added } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ total: 500, currency: 'BRL' }));

      await request(app)
        .delete(`/api/transactions/${added.transactions[0].id}`)
        .set(auth());

      const { body: usdWallet } = await request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: 'USD wallet', currency: 'USD' });

      const { status, body } = await request(app)
        .put(`/api/invoices/${invoice.id}`)
        .set(auth())
        .send({ walletId: usdWallet.id });

      expect(status).toEqual(400);
      expect(body.message).toMatch(/currency/i);
    });

    it('should allow changing currency on an invoice with no transactions', async () => {
      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload({ currency: 'BRL', amount: 1000 }));

      const { status } = await request(app)
        .put(`/api/invoices/${invoice.id}`)
        .set(auth())
        .send({ currency: 'USD' });

      expect(status).toEqual(200);
    });
  });

  describe('Amount edit — status recalculation', () => {
    it('should drop from paid to partial when amount is increased beyond paidAmount', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 1000 }));

      const { body: paid } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(paid.status).toEqual('paid');

      const { body, status } = await request(app).put(`/api/invoices/${invoice.id}`).set(auth()).send({ amount: 1500 });

      expect(status).toEqual(200);
      expect(body.status).toEqual('partial');
      expect(body.total).toEqual({ amount: 1500, currency: 'BRL' });
      expect(body.paidAmount).toEqual({ amount: 1000, currency: 'BRL' });
    });

    it('should rise from partial to paid when amount is decreased to match paidAmount', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 600 }));

      const { body, status } = await request(app).put(`/api/invoices/${invoice.id}`).set(auth()).send({ amount: 600 });

      expect(status).toEqual(200);
      expect(body.status).toEqual('paid');
    });

    it('should drop from paid to pending when amount is increased and there are no transactions', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 500 }));
      await request(app).patch(`/api/invoices/${invoice.id}/mark-paid`).set(auth());

      const { body, status } = await request(app).put(`/api/invoices/${invoice.id}`).set(auth()).send({ amount: 1000 });

      expect(status).toEqual(200);
      expect(body.status).toEqual('pending');
    });
  });

  describe('Unmark paid', () => {
    it('should revert a force-paid invoice with no transactions to pending', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).patch(`/api/invoices/${invoice.id}/mark-paid`).set(auth());

      const { body, status } = await request(app).patch(`/api/invoices/${invoice.id}/unmark-paid`).set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('pending');
      expect(body.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.history).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'mark_unpaid', status: 'pending' })]));
    });

    it('should revert a force-paid invoice with partial payments to partial', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 400 }));
      await request(app).patch(`/api/invoices/${invoice.id}/mark-paid`).set(auth());

      const { body, status } = await request(app).patch(`/api/invoices/${invoice.id}/unmark-paid`).set(auth());

      expect(status).toEqual(200);
      expect(body.status).toEqual('partial');
      expect(body.paidAmount).toEqual({ amount: 400, currency: 'BRL' });
    });

    it('should return 400 when invoice is not paid', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 1000 }));

      const { status } = await request(app).patch(`/api/invoices/${invoice.id}/unmark-paid`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 when invoice is fully covered by transactions', async () => {
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ amount: 500 }));
      await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: 500 }));

      const { status } = await request(app).patch(`/api/invoices/${invoice.id}/unmark-paid`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 404 for unknown invoice', async () => {
      const { status } = await request(app).patch('/api/invoices/00000000-0000-0000-0000-000000000000/unmark-paid').set(auth());
      expect(status).toEqual(404);
    });
  });

  describe('Isolation between users', () => {
    it("should not return another user's invoices in the list", async () => {
      const user2 = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user2);
      const { body: s2 } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send(buildPayload());

      const { body: { data: user2Invoices } } = await request(app)
        .get('/api/invoices')
        .set({ Authorization: `Bearer ${s2.token}` });

      expect(user2Invoices.every((i: any) => i.id !== invoice.id)).toBe(true);
    });
  });

  describe('Forecast', () => {
    let forecastContactId: string;
    let forecastContractId: string;

    // Place nextDueDate 60 days out; query window is 30–65 days — well inside the range
    // but after a generate, the advanced nextDueDate (~90 days) falls outside endDate
    const futureDueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 65 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    beforeAll(async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send({ name: faker.person.fullName() });
      forecastContactId = contact.id;

      const { body: contract } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send({
          contactId: forecastContactId,
          type: 'payable',
          amount: 800,
          currency: 'BRL',
          description: 'forecast test contract',
          instalments: 3,
          cycleMonths: 1,
          firstDueDate: futureDueDate.toISOString(),
          name: faker.company.name(),
        });
      forecastContractId = contract.id;
    });

    it('should return 400 when forecast=true but startDate is missing', async () => {
      const { status } = await request(app).get('/api/invoices?forecast=true').set(auth());
      expect(status).toEqual(400);
    });

    it('should return projected invoice from an active contract', async () => {
      const { body: { data: body }, status } = await request(app)
        .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastContactId}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        projected: true,
        contractId: forecastContractId,
        type: 'payable',
        status: 'projected',
        isOverdue: false,
        total: { amount: 800, currency: 'BRL' },
        paidAmount: { amount: 0, currency: 'BRL' },
      });
      expect(body[0].id).toBeUndefined();
    });

    it('after generating, real invoice has projected:false and next cycle is outside range', async () => {
      await request(app).post(`/api/contracts/${forecastContractId}/generate`).set(auth());

      const { body: { data: body }, status } = await request(app)
        .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastContactId}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);

      const real = body.find((i: any) => !i.projected);
      expect(real).toBeDefined();
      expect(real.projected).toBe(false);
      expect(real.contractId).toEqual(forecastContractId);
      expect(real.id).toBeDefined();

      // Advanced nextDueDate (~90 days) is outside endDate (65 days) — no projected entry
      expect(body.filter((i: any) => i.projected === true && i.contractId === forecastContractId)).toHaveLength(0);
    });

    it('should filter projected items by type', async () => {
      const { body: contact2 } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send({ name: faker.person.fullName() });

      await request(app)
        .post('/api/contracts')
        .set(auth())
        .send({
          contactId: contact2.id,
          type: 'receivable',
          amount: 600,
          currency: 'BRL',
          description: 'receivable forecast test',
          instalments: 3,
          cycleMonths: 1,
          firstDueDate: futureDueDate.toISOString(),
          name: faker.company.name(),
        });

      const { body: { data: body }, status } = await request(app)
        .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByType=receivable&filterByContactId=${contact2.id}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body.every((i: any) => i.type === 'receivable')).toBe(true);
    });

    it('without forecast=true, response has no projected field', async () => {
      const { body: { data: body }, status } = await request(app)
        .get(`/api/invoices?startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastContactId}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.every((i: any) => i.projected === undefined)).toBe(true);
    });

    describe('Description and contact name filtering for projected invoices', () => {
      const forecastFilterContactName = 'ForecastFilterContact SpecialUser';
      const contractDesc = 'ForecastDescTest_contract';
      let forecastFilterContactId: string;
      let forecastFilterContractId: string;

      beforeAll(async () => {
        const { body: contact } = await request(app)
          .post('/api/contacts')
          .set(auth())
          .send({ name: forecastFilterContactName });
        forecastFilterContactId = contact.id;

        const { body: contract } = await request(app)
          .post('/api/contracts')
          .set(auth())
          .send({
            contactId: forecastFilterContactId,
            type: 'payable',
            amount: 500,
            currency: 'BRL',
            description: contractDesc,
            instalments: 3,
            cycleMonths: 1,
            firstDueDate: futureDueDate.toISOString(),
            name: 'forecast filter test',
          });
        forecastFilterContractId = contract.id;
      });

      it('should include projected invoices matching the description filter', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&description=ForecastDescTest`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((i: any) => i.projected && i.contractId === forecastFilterContractId)).toBe(true);
      });

      it('should exclude projected invoices when description does not match', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&description=NOMATCH_XYZ`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.filter((i: any) => i.contractId === forecastFilterContractId)).toHaveLength(0);
      });

      it('should filter projected invoices by contact name', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactName=ForecastFilterContact`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((i: any) => i.projected && i.contractId === forecastFilterContractId)).toBe(true);
      });

      it('should exclude projected invoices when contact name does not match', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&filterByContactName=NoSuchNameXYZ`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.filter((i: any) => i.contractId === forecastFilterContractId)).toHaveLength(0);
      });

      it('should match projected invoices by description via search (OR)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&search=ForecastDescTest`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((i: any) => i.projected && i.contractId === forecastFilterContractId)).toBe(true);
      });

      it('should match projected invoices by contact name via search (OR)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&search=ForecastFilterContact`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((i: any) => i.projected && i.contractId === forecastFilterContractId)).toBe(true);
      });

      it('should exclude projected invoices when search matches neither description nor contact name', async () => {
        const { body: { data: body }, status } = await request(app)
          .get(`/api/invoices?forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${forecastFilterContactId}&search=NOMATCH_SEARCH_XYZ`)
          .set(auth());

        expect(status).toEqual(200);
        expect(body.filter((i: any) => i.contractId === forecastFilterContractId)).toHaveLength(0);
      });
    });
  });

  describe('Forecast sorting and pagination', () => {
    const day = 24 * 60 * 60 * 1000;
    const startDate = new Date(Date.now() - day).toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 70 * day).toISOString().split('T')[0];
    let query: string;

    // 3 real invoices (outstanding 50, 100, 300) + a contract projecting 2 instalments of 200
    beforeAll(async () => {
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      query = `forecast=true&startDate=${startDate}&endDate=${endDate}&filterByContactId=${contact.id}`;

      const specs: Array<[number, number]> = [[500, 450], [100, 0], [300, 0]];
      for (const [i, [amount, paid]] of specs.entries()) {
        const { body: invoice } = await request(app)
          .post('/api/invoices')
          .set(auth())
          .send(buildPayload({ contactId: contact.id, amount, dueDate: new Date(Date.now() + (i + 1) * 5 * day).toISOString() }));
        if (paid) {
          await request(app).post(`/api/invoices/${invoice.id}/transactions`).set(auth()).send(buildTransactionPayload({ total: paid }));
        }
      }

      await request(app).post('/api/contracts').set(auth()).send({
        contactId: contact.id,
        type: 'receivable',
        amount: 200,
        currency: 'BRL',
        description: 'forecast sort contract',
        instalments: 2,
        cycleMonths: 1,
        firstDueDate: new Date(Date.now() + 30 * day).toISOString(),
        name: faker.company.name(),
      });
    });

    const amounts = (body: any[]) => body.map((i) => i.total.amount);
    const outstanding = (body: any[]) => body.map((i) => i.total.amount - i.paidAmount.amount);

    it('should sort real and projected invoices together by amount', async () => {
      const { body: { data: desc } } = await request(app).get(`/api/invoices?${query}&sortBy=amount&sortOrder=desc`).set(auth());
      expect(amounts(desc)).toEqual([500, 300, 200, 200, 100]);

      const { body: { data: asc } } = await request(app).get(`/api/invoices?${query}&sortBy=amount&sortOrder=asc`).set(auth());
      expect(amounts(asc)).toEqual([100, 200, 200, 300, 500]);
    });

    it('should sort real and projected invoices together by outstanding balance', async () => {
      const { body: { data: asc } } = await request(app).get(`/api/invoices?${query}&sortBy=outstanding&sortOrder=asc`).set(auth());
      expect(outstanding(asc)).toEqual([50, 100, 200, 200, 300]);

      const { body: { data: desc } } = await request(app).get(`/api/invoices?${query}&sortBy=outstanding&sortOrder=desc`).set(auth());
      expect(outstanding(desc)).toEqual([300, 200, 200, 100, 50]);
    });

    it('should keep sorting by dueDate ascending by default', async () => {
      const { body: { data: body } } = await request(app).get(`/api/invoices?${query}`).set(auth());
      const dueDates = body.map((i: any) => new Date(i.dueDate).getTime());
      expect(dueDates).toEqual([...dueDates].sort((a, b) => a - b));
      expect(body).toHaveLength(5);
    });

    it('should paginate the merged list without repeating projected invoices', async () => {
      const pages = [];
      for (const page of [1, 2, 3]) {
        const { body: { data: body } } = await request(app)
          .get(`/api/invoices?${query}&sortBy=amount&sortOrder=desc&limit=2&page=${page}`)
          .set(auth());
        pages.push(body);
      }
      expect(pages.map((p) => p.length)).toEqual([2, 2, 1]);
      expect(amounts(pages.flat())).toEqual([500, 300, 200, 200, 100]);
    });

    it('should count real and projected invoices in the pagination info', async () => {
      const { body } = await request(app).get(`/api/invoices?${query}&limit=2&page=3`).set(auth());
      expect(body.pagination).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3, hasNextPage: false });
    });
  });

  describe('Signed sort', () => {
    // receivable 300 (paid 250, 50 left), receivable 80, payable 200 (paid 50, 150 left), payable 40
    let query: string;
    const signed = (body: any[], value: (i: any) => number) =>
      body.map((i) => (i.type === 'payable' ? -1 : 1) * value(i));

    beforeAll(async () => {
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      query = `filterByContactId=${contact.id}`;
      const specs: Array<[string, number, number]> = [
        ['receivable', 300, 250],
        ['receivable', 80, 0],
        ['payable', 200, 50],
        ['payable', 40, 0],
      ];
      for (const [type, amount, paid] of specs) {
        const { body: invoice } = await request(app)
          .post('/api/invoices')
          .set(auth())
          .send(buildPayload({ contactId: contact.id, type, amount }));
        if (paid) {
          await request(app)
            .post(`/api/invoices/${invoice.id}/transactions`)
            .set(auth())
            .send(buildTransactionPayload({ total: paid }));
        }
      }
    });

    it('should sort amount signed', async () => {
      const { body: { data: body } } = await request(app).get(`/api/invoices?${query}&sortBy=amount&sortOrder=desc`).set(auth());
      expect(signed(body, (i) => i.total.amount)).toEqual([300, 80, -40, -200]);
    });

    it('should sort outstanding balance signed', async () => {
      const { body: { data: body } } = await request(app).get(`/api/invoices?${query}&sortBy=outstanding&sortOrder=asc`).set(auth());
      expect(signed(body, (i) => i.total.amount - i.paidAmount.amount)).toEqual([-150, -40, 50, 80]);
    });

    it('should sort signed in forecast mode too', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { body: { data: body } } = await request(app)
        .get(`/api/invoices?${query}&forecast=true&startDate=${startDate}&sortBy=amount&sortOrder=desc`)
        .set(auth());
      expect(signed(body, (i) => i.total.amount)).toEqual([300, 80, -40, -200]);
    });
  });
});

describe('Invoices — wallet, notes, tag ids and cancel reason', () => {
  const createWallet = async () => {
    const { body } = await request(app)
      .post('/api/wallets')
      .set(auth())
      .send({ name: `wallet-${faker.string.alphanumeric(10)}`, currency: 'BRL' });
    return body;
  };

  const createInvoice = async (overrides?: object) => {
    const { body } = await request(app).post('/api/invoices').set(auth()).send(buildPayload(overrides));
    return body;
  };

  const lastHistoryEvent = (invoice: any) => invoice.history[invoice.history.length - 1];

  describe('Embedded wallet', () => {
    it('should embed the wallet and keep walletId', async () => {
      const wallet = await createWallet();
      const invoice = await createInvoice({ walletId: wallet.id, currency: undefined });

      expect(invoice.walletId).toEqual(wallet.id);
      expect(invoice.wallet).toEqual({ id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: null });

      const withoutWallet = await createInvoice();
      expect(withoutWallet.wallet).toBeNull();
    });

    it('should still embed the wallet after it is soft-deleted, on list, detail and payments', async () => {
      const wallet = await createWallet();
      const marker = `deleted-wallet-${faker.string.alphanumeric(10)}`;
      const invoice = await createInvoice({ walletId: wallet.id, currency: undefined, description: marker });
      await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ currency: undefined }));

      await request(app).delete(`/api/wallets/${wallet.id}`).set(auth());

      const expected = { id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: expect.any(String) };

      const { body: detail } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(detail.walletId).toEqual(wallet.id);
      expect(detail.wallet).toEqual(expected);
      expect(detail.transactions).toHaveLength(1);
      expect(detail.transactions[0].walletId).toEqual(wallet.id);
      expect(detail.transactions[0].wallet).toEqual(expected);

      const { body: list } = await request(app).get(`/api/invoices?description=${marker}`).set(auth());
      expect(list.data).toHaveLength(1);
      expect(list.data[0].wallet).toEqual(expected);
    });

    it('should embed the contract wallet on projected invoices', async () => {
      const wallet = await createWallet();
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      await request(app)
        .post('/api/contracts')
        .set(auth())
        .send({
          contactId: contact.id,
          walletId: wallet.id,
          type: 'payable',
          amount: 100,
          description: 'projected wallet contract',
          instalments: 1,
          cycleMonths: 1,
          firstDueDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
          name: faker.company.name(),
        });
      await request(app).delete(`/api/wallets/${wallet.id}`).set(auth());

      const startDate = new Date().toISOString().split('T')[0];
      const { body } = await request(app)
        .get(`/api/invoices?forecast=true&startDate=${startDate}&filterByContactId=${contact.id}`)
        .set(auth());

      expect(body.data).toHaveLength(1);
      expect(body.data[0].projected).toBe(true);
      expect(body.data[0].walletId).toEqual(wallet.id);
      expect(body.data[0].wallet).toEqual({ id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: expect.any(String) });
    });
  });

  describe('Notes', () => {
    it('should create an invoice with notes and default to null without them', async () => {
      const withNotes = await createInvoice({ notes: 'call before paying' });
      expect(withNotes.notes).toEqual('call before paying');

      const { body: detail } = await request(app).get(`/api/invoices/${withNotes.id}`).set(auth());
      expect(detail.notes).toEqual('call before paying');

      const withoutNotes = await createInvoice();
      expect(withoutNotes.notes).toBeNull();
    });

    it('should update notes and record the change in history', async () => {
      const invoice = await createInvoice({ notes: 'old' });

      const { body } = await request(app).put(`/api/invoices/${invoice.id}`).set(auth()).send({ notes: 'new' });
      expect(body.notes).toEqual('new');
      expect(lastHistoryEvent(body)).toMatchObject({ event: 'updated', changes: { notes: 'new' } });

      const { body: cleared } = await request(app).put(`/api/invoices/${invoice.id}`).set(auth()).send({ notes: null });
      expect(cleared.notes).toBeNull();
    });

    it('should return 400 when notes are longer than 2000 characters', async () => {
      const { status } = await request(app).post('/api/invoices').set(auth()).send(buildPayload({ notes: 'a'.repeat(2001) }));
      expect(status).toEqual(400);
    });

    it('should save notes on a payment transaction', async () => {
      const invoice = await createInvoice();
      const { body } = await request(app)
        .post(`/api/invoices/${invoice.id}/transactions`)
        .set(auth())
        .send(buildTransactionPayload({ notes: 'bank transfer' }));

      expect(body.transactions[0].notes).toEqual('bank transfer');
      const { body: transaction } = await request(app).get(`/api/transactions/${body.transactions[0].id}`).set(auth());
      expect(transaction.notes).toEqual('bank transfer');
    });

    it('should match notes via search', async () => {
      const marker = faker.string.alphanumeric(12);
      const invoice = await createInvoice({ notes: `see ${marker}` });

      const { body } = await request(app).get(`/api/invoices?search=${marker}`).set(auth());
      expect(body.data.map((i: any) => i.id)).toEqual([invoice.id]);
    });
  });

  describe('Filter by tag id', () => {
    const marker = faker.string.alphanumeric(10).toLowerCase();
    let exact: any;
    let partial: any;

    beforeAll(async () => {
      exact = await createInvoice({ tags: [`food${marker}`] });
      partial = await createInvoice({ tags: [`sea food${marker}`] });
    });

    it('should match the tag name partially with filterByTag', async () => {
      const { body } = await request(app).get(`/api/invoices?filterByTag=food${marker}`).set(auth());
      expect(body.data.map((i: any) => i.id).sort()).toEqual([exact.id, partial.id].sort());
    });

    it('should match only the exact tag with filterByTagId', async () => {
      const { body, status } = await request(app).get(`/api/invoices?filterByTagId=${exact.tags[0].id}`).set(auth());
      expect(status).toEqual(200);
      expect(body.data.map((i: any) => i.id)).toEqual([exact.id]);
    });

    it('should return 400 for an invalid tag id', async () => {
      const { status } = await request(app).get('/api/invoices?filterByTagId=not-a-uuid').set(auth());
      expect(status).toEqual(400);
    });
  });

  describe('Cancel reason', () => {
    it('should store the reason on the cancelled history event', async () => {
      const invoice = await createInvoice();

      const { body, status } = await request(app)
        .delete(`/api/invoices/${invoice.id}`)
        .set(auth())
        .send({ reason: 'duplicated invoice' });

      expect(status).toEqual(200);
      expect(lastHistoryEvent(body)).toMatchObject({ event: 'cancelled', reason: 'duplicated invoice' });

      const { body: deleted } = await request(app).get(`/api/invoices/${invoice.id}?deleted=true`).set(auth());
      expect(lastHistoryEvent(deleted)).toMatchObject({ event: 'cancelled', reason: 'duplicated invoice' });
    });

    it('should cancel without a body and leave the reason out', async () => {
      const invoice = await createInvoice();

      const { body, status } = await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      expect(status).toEqual(200);
      expect(lastHistoryEvent(body).event).toEqual('cancelled');
      expect(lastHistoryEvent(body)).not.toHaveProperty('reason');
    });

    it('should store the reason on the restored history event', async () => {
      const invoice = await createInvoice();
      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth()).send({ reason: 'by mistake' });

      const { body } = await request(app)
        .patch(`/api/invoices/${invoice.id}/restore`)
        .set(auth())
        .send({ reason: 'cancelled the wrong one' });

      expect(body.status).toEqual('pending');
      expect(lastHistoryEvent(body)).toMatchObject({ event: 'restored', reason: 'cancelled the wrong one' });
    });

    it('should return 400 when the reason is longer than 500 characters', async () => {
      const invoice = await createInvoice();
      const { status } = await request(app)
        .delete(`/api/invoices/${invoice.id}`)
        .set(auth())
        .send({ reason: 'a'.repeat(501) });
      expect(status).toEqual(400);
    });
  });
});
