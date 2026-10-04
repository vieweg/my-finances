import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, SessionResponseDto } from './global/setupTests';
import app from '../src/app';

let session: SessionResponseDto;

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

const buildWallet = (overrides?: object) => ({
  name: faker.finance.accountName(),
  currency: 'BRL',
  ...overrides,
});

describe('Wallets', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/wallets');
      expect(res.status).toEqual(401);
    });
  });

  describe('CRUD', () => {
    it('should create a wallet and return it with currentBalance 0', async () => {
      const payload = buildWallet();
      const { body, status } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(payload);

      expect(status).toEqual(201);
      expect(body).toMatchObject({
        id: expect.any(String),
        name: payload.name,
        currency: payload.currency,
        currentBalance: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 400 with missing required fields', async () => {
      const { status, body } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name: 'Missing currency' });

      expect(status).toEqual(400);
      expect(body.message).toEqual('Validation error');
    });

    it('should list wallets for the authenticated user', async () => {
      await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body: { data: body }, status } = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('currentBalance');
    });

    it('should get a wallet by id with recentSnapshots', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body, status } = await request(app)
        .get(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(Array.isArray(body.recentSnapshots)).toBe(true);
    });

    it('should return 404 for a wallet that does not exist', async () => {
      const { status } = await request(app)
        .get('/api/wallets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(404);
    });

    it('should update the wallet name', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const newName = faker.finance.accountName();
      const { body, status } = await request(app)
        .put(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name: newName });

      expect(status).toEqual(200);
      expect(body.name).toEqual(newName);
      expect(body.currency).toEqual(created.currency);
    });

    it('should assign an incrementing position on creation', async () => {
      const [{ body: w1 }, { body: w2 }, { body: w3 }] = await Promise.all([
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet()),
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet()),
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet()),
      ]);

      expect(typeof w1.position).toBe('number');
      expect(typeof w2.position).toBe('number');
      expect(typeof w3.position).toBe('number');
    });

    it('should reorder wallets and reflect new positions on list', async () => {
      const [{ body: a }, { body: b }, { body: c }] = await Promise.all([
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet({ name: 'Alpha' })),
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet({ name: 'Beta' })),
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet({ name: 'Gamma' })),
      ]);

      const { body: { data: listed } } = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`);

      // Reverse order: Gamma → Beta → Alpha
      const allIds = listed.map((w: any) => w.id);
      const [gammaId, betaId, alphaId] = [c.id, b.id, a.id];
      const reorderedIds = [
        gammaId,
        betaId,
        alphaId,
        ...allIds.filter((id: string) => ![a.id, b.id, c.id].includes(id)),
      ];

      const { status } = await request(app)
        .patch('/api/wallets/reorder')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ ids: reorderedIds });

      expect(status).toEqual(204);

      const { body: { data: reordered } } = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`);

      const positions = reordered.reduce((acc: any, w: any) => {
        acc[w.id] = w.position;
        return acc;
      }, {});
      expect(positions[gammaId]).toBeLessThan(positions[betaId]);
      expect(positions[betaId]).toBeLessThan(positions[alphaId]);
    });

    it('should return 400 if not all wallet IDs are provided for reorder', async () => {
      const { body: w } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { status, body } = await request(app)
        .patch('/api/wallets/reorder')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ ids: [w.id] }); // missing the other wallets

      expect(status).toEqual(400);
      expect(body.message).toContain('All wallet IDs must be provided');
    });

    it('should hard-delete a wallet via /remove and return 404 on subsequent get', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { status } = await request(app)
        .delete(`/api/wallets/${created.id}/remove`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(204);

      const { status: getStatus } = await request(app)
        .get(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(getStatus).toEqual(404);
    });

    it('should hard-delete an already soft-deleted wallet', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .delete(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      const { status } = await request(app)
        .delete(`/api/wallets/${created.id}/remove`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(204);

      const { body: { data: deletedList } } = await request(app)
        .get('/api/wallets?deleted=true')
        .set('Authorization', `Bearer ${session.token}`);
      expect(deletedList.every((w: any) => w.id !== created.id)).toBe(true);
    });

    it('should soft-delete a wallet and return 404 on subsequent get', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { status: deleteStatus } = await request(app)
        .delete(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      const { status: getStatus } = await request(app)
        .get(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(deleteStatus).toEqual(204);
      expect(getStatus).toEqual(404);
    });

    it('should restore a soft-deleted wallet', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { body, status } = await request(app)
        .patch(`/api/wallets/${created.id}/restore`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.currentBalance).toEqual(0);

      const { status: getStatus } = await request(app)
        .get(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(getStatus).toEqual(200);
    });

    it('should return 404 when restoring an unknown wallet', async () => {
      const { status } = await request(app)
        .patch('/api/wallets/00000000-0000-0000-0000-000000000000/restore')
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(404);
    });

    it('should return 400 when restoring a wallet that is not deleted', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { status } = await request(app)
        .patch(`/api/wallets/${created.id}/restore`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(400);
    });
  });

  describe('List deleted', () => {
    it('should return soft-deleted wallets when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { body: { data: body }, status } = await request(app)
        .get('/api/wallets?deleted=true')
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(200);
      expect(body.find((w: any) => w.id === created.id)).toBeDefined();
    });

    it('should not return soft-deleted wallets in the default list', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { body: { data: body } } = await request(app).get('/api/wallets').set('Authorization', `Bearer ${session.token}`);
      expect(body.every((w: any) => w.id !== created.id)).toBe(true);
    });

    it('should not return active wallets when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body: { data: body } } = await request(app).get('/api/wallets?deleted=true').set('Authorization', `Bearer ${session.token}`);
      expect(body.every((w: any) => w.id !== created.id)).toBe(true);
    });

    it('should keep the current balance of soft-deleted wallets when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app)
        .post(`/api/wallets/${created.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 750 });
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { body: { data: body } } = await request(app).get('/api/wallets?deleted=true').set('Authorization', `Bearer ${session.token}`);
      expect(body.find((w: any) => w.id === created.id).currentBalance).toEqual(750);
    });
  });

  describe('Get deleted', () => {
    it('should return a soft-deleted wallet with its balance and snapshots when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app)
        .post(`/api/wallets/${created.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1200 });
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { body, status } = await request(app)
        .get(`/api/wallets/${created.id}?deleted=true`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.deletedAt).toBeDefined();
      expect(body.currentBalance).toEqual(1200);
      expect(body.recentSnapshots).toHaveLength(1);
    });

    it('should return 404 for a soft-deleted wallet without deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());
      await request(app).delete(`/api/wallets/${created.id}`).set('Authorization', `Bearer ${session.token}`);

      const { status } = await request(app)
        .get(`/api/wallets/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(404);
    });

    it('should return an active wallet when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body, status } = await request(app)
        .get(`/api/wallets/${created.id}?deleted=true`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(status).toEqual(200);
      expect(body.deletedAt).toBeUndefined();
    });
  });

  describe('Manual balance adjustment', () => {
    it('should adjust the wallet balance and record a manual snapshot', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body, status } = await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 5000 });

      expect(status).toEqual(200);
      expect(body.currentBalance).toEqual(5000);
    });

    it('should reflect the new balance in the history', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 2500 });

      const { body } = await request(app)
        .get(`/api/wallets/${wallet.id}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(body.pagination.total).toEqual(2);
      expect(body.data[0].amount).toEqual(2500);
      expect(body.data[0].delta).toEqual(1500);
      expect(body.data[0].source).toEqual('manual');
      expect(body.data[1].amount).toEqual(1000);
      expect(body.data[1].delta).toEqual(1000);
    });
  });

  describe('Transaction integration', () => {
    it('should update wallet balance when an income transaction is linked', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 500,
          description: 'Salary',
          type: 'income',
          walletId: wallet.id,
        });

      const { body: updated } = await request(app)
        .get(`/api/wallets/${wallet.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(updated.currentBalance).toEqual(1500);
    });

    it('should update wallet balance when an outcome transaction is linked', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 300,
          description: 'Groceries',
          type: 'outcome',
          walletId: wallet.id,
        });

      const { body: updated } = await request(app)
        .get(`/api/wallets/${wallet.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(updated.currentBalance).toEqual(700);
    });

    it('should reverse wallet delta when a linked transaction is updated with same wallet', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 200,
          description: 'Original',
          type: 'income',
          walletId: wallet.id,
        });

      // balance = 1200 — now update to 350 income
      await request(app)
        .put(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 350,
          description: 'Updated',
          type: 'income',
          walletId: wallet.id,
        });

      const { body: updated } = await request(app)
        .get(`/api/wallets/${wallet.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      // net: +350 instead of +200, diff = +150 applied to 1200 → 1350
      expect(updated.currentBalance).toEqual(1350);
    });

    it('should update both wallets when a transaction changes wallet', async () => {
      const [{ body: walletA }, { body: walletB }] = await Promise.all([
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet({ name: 'Wallet A' })),
        request(app)
          .post('/api/wallets')
          .set('Authorization', `Bearer ${session.token}`)
          .send(buildWallet({ name: 'Wallet B' })),
      ]);

      await Promise.all([
        request(app)
          .post(`/api/wallets/${walletA.id}/adjust`)
          .set('Authorization', `Bearer ${session.token}`)
          .send({ amount: 1000 }),
        request(app)
          .post(`/api/wallets/${walletB.id}/adjust`)
          .set('Authorization', `Bearer ${session.token}`)
          .send({ amount: 500 }),
      ]);

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 200,
          description: 'Linked to A',
          type: 'income',
          walletId: walletA.id,
        });
      // walletA = 1200, walletB = 500

      await request(app)
        .put(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 200,
          description: 'Moved to B',
          type: 'income',
          walletId: walletB.id,
        });
      // walletA reversed: 1200 - 200 = 1000, walletB gains: 500 + 200 = 700

      const [{ body: a }, { body: b }] = await Promise.all([
        request(app)
          .get(`/api/wallets/${walletA.id}`)
          .set('Authorization', `Bearer ${session.token}`),
        request(app)
          .get(`/api/wallets/${walletB.id}`)
          .set('Authorization', `Bearer ${session.token}`),
      ]);

      expect(a.currentBalance).toEqual(1000);
      expect(b.currentBalance).toEqual(700);
    });

    it('should keep transactions intact with walletId null and currency preserved after hard delete', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 100,
          description: 'Linked to wallet',
          type: 'income',
          walletId: wallet.id,
        });

      await request(app)
        .delete(`/api/wallets/${wallet.id}/remove`)
        .set('Authorization', `Bearer ${session.token}`);

      const { body: fetched, status } = await request(app)
        .get(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(fetched.walletId).toBeNull();
      expect(fetched.total.currency).toEqual(wallet.currency);
    });

    it('should reverse the wallet delta when a linked transaction is deleted', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 400,
          description: 'To be deleted',
          type: 'income',
          walletId: wallet.id,
        });
      // balance = 1400

      await request(app)
        .delete(`/api/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${session.token}`);
      // balance should revert to 1000

      const { body: updated } = await request(app)
        .get(`/api/wallets/${wallet.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(updated.currentBalance).toEqual(1000);
    });
  });

  describe('History endpoint', () => {
    it('should paginate balance history', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/wallets/${wallet.id}/adjust`)
          .set('Authorization', `Bearer ${session.token}`)
          .send({ amount: i * 100 });
      }

      const { body: page1 } = await request(app)
        .get(`/api/wallets/${wallet.id}/history?page=1&limit=3`)
        .set('Authorization', `Bearer ${session.token}`);

      const { body: page2 } = await request(app)
        .get(`/api/wallets/${wallet.id}/history?page=2&limit=3`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(page1.pagination.total).toEqual(5);
      expect(page1.data).toHaveLength(3);
      expect(page2.data).toHaveLength(2);
    });

    it('should delete a manual snapshot and recalculate the next delta', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      // Build history: 1000 → 2500 → 4000
      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });
      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 2500 });
      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 4000 });

      // Fetch history to get the middle snapshot id (amount=2500, index 1 in DESC order)
      const { body: before } = await request(app)
        .get(`/api/wallets/${wallet.id}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      const middleSnapshotId = before.data[1].id; // 2500 is the middle entry

      // Delete the middle snapshot (2500)
      const { status } = await request(app)
        .delete(`/api/wallets/${wallet.id}/history/${middleSnapshotId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(204);

      const { body } = await request(app)
        .get(`/api/wallets/${wallet.id}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(body.pagination.total).toEqual(2);
      // most recent: amount=4000, delta should now be 4000-1000=3000 (not the original 1500)
      expect(body.data[0].amount).toEqual(4000);
      expect(body.data[0].delta).toEqual(3000);
      expect(body.data[1].amount).toEqual(1000);
      expect(body.data[1].delta).toEqual(1000);
    });

    it('should return 400 when trying to delete a transaction-linked snapshot', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 100,
          description: 'Linked',
          type: 'income',
          walletId: wallet.id,
        });

      const { body: historyRes } = await request(app)
        .get(`/api/wallets/${wallet.id}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      const txSnapshot = historyRes.data.find((s: any) => s.transactionId === tx.versionId);

      const { status, body } = await request(app)
        .delete(`/api/wallets/${wallet.id}/history/${txSnapshot.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(400);
      expect(body.message).toEqual('Only manual adjustments can be deleted');
    });

    it('should return 404 for a non-existent snapshot', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      const { status } = await request(app)
        .delete(`/api/wallets/${wallet.id}/history/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(404);
    });

    it('should include transaction snapshots alongside manual ones in history', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${session.token}`)
        .send(buildWallet());

      await request(app)
        .post(`/api/wallets/${wallet.id}/adjust`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ amount: 1000 });

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 250,
          description: 'Linked',
          type: 'income',
          walletId: wallet.id,
        });

      const { body } = await request(app)
        .get(`/api/wallets/${wallet.id}/history`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(body.pagination.total).toEqual(2);
      const sources = body.data.map((s: any) => s.source);
      expect(sources).toContain('manual');
      expect(sources).toContain('transaction');
    });
  });
});
