import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, buildCreateUserPayload, SessionResponseDto } from './global/setupTests';
import { dataSource } from '../src/database';
import { RepairWalletSnapshotChain1790812800000 } from '../src/database/migrations/1790812800000-repair_wallet_snapshot_chain';
import app from '../src/app';

let session: SessionResponseDto;

const auth = (token = session.token) => ({ Authorization: `Bearer ${token}` });

const createWallet = async (currency = 'BRL', token?: string) => {
  const { body } = await request(app)
    .post('/api/wallets')
    .set(auth(token))
    .send({ name: `wallet-${faker.string.alphanumeric(10)}`, currency });
  return body;
};

const adjust = (walletId: string, amount: number, recordedAt: string) =>
  request(app).post(`/api/wallets/${walletId}/adjust`).set(auth()).send({ amount, recordedAt });

const createTransaction = async (walletId: string, date: string, total: number, type = 'income') => {
  const { body } = await request(app)
    .post('/api/transactions')
    .set(auth())
    .send({ walletId, date, total, type, description: faker.lorem.words(3) });
  return body;
};

const series = (query: string, token?: string) =>
  request(app).get(`/api/wallets/balance-series?${query}`).set(auth(token));

const balancesOf = async (walletId: string, query: string) => {
  const { body, status } = await series(`walletId=${walletId}&${query}`);
  expect(status).toEqual(200);
  return body.series[0].balances;
};

// Its own user, so the many wallets created here don't crowd other test files' wallet lists
beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body: admin } = await request(app).post('/api/sessions').send({ username, password });
  const user = buildCreateUserPayload();
  await request(app).post('/api/users').set({ Authorization: `Bearer ${admin.token}` }).send(user);
  const { body } = await request(app).post('/api/sessions').send({ username: user.username, password: user.password });
  session = body;
});

describe('Wallet balance series', () => {
  describe('Validation', () => {
    it('should return 401 without a token', async () => {
      const { status } = await request(app).get('/api/wallets/balance-series?startDate=2025-03-01&endDate=2025-03-02');
      expect(status).toEqual(401);
    });

    it('should require startDate and endDate', async () => {
      expect((await series('startDate=2025-03-01')).status).toEqual(400);
      expect((await series('endDate=2025-03-01')).status).toEqual(400);
    });

    it('should reject dates that are not YYYY-MM-DD or do not exist', async () => {
      expect((await series('startDate=2025-02-30&endDate=2025-03-01')).status).toEqual(400);
      expect((await series('startDate=2025-03-01T10:00:00Z&endDate=2025-03-02')).status).toEqual(400);
    });

    it('should reject an endDate before startDate', async () => {
      expect((await series('startDate=2025-03-02&endDate=2025-03-01')).status).toEqual(400);
    });

    it('should reject an unknown time zone', async () => {
      const { status } = await series('startDate=2025-03-01&endDate=2025-03-02&timezone=Mars/Olympus');
      expect(status).toEqual(400);
    });

    it('should reject a range with too many periods and suggest a larger interval', async () => {
      const { status, body } = await series('startDate=2024-01-01&endDate=2025-12-31&interval=day');
      expect(status).toEqual(400);
      expect(body.message).toMatch(/interval=week/);
    });

    it('should return 404 for a wallet of another user or that does not exist', async () => {
      const { status } = await series(`startDate=2025-03-01&endDate=2025-03-02&walletId=${faker.string.uuid()}`);
      expect(status).toEqual(404);
    });
  });

  describe('Periods', () => {
    it('should list every day in a short range and default to day', async () => {
      const wallet = await createWallet();
      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-01&endDate=2025-03-05`);

      expect(body.interval).toEqual('day');
      expect(body.buckets).toEqual(['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05']);
    });

    it('should default to weeks starting on Monday for up to 6 months', async () => {
      const wallet = await createWallet();
      // 2025-03-05 is a Wednesday
      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-05&endDate=2025-05-31`);

      expect(body.interval).toEqual('week');
      expect(body.buckets[0]).toEqual('2025-03-03');
      expect(body.buckets[1]).toEqual('2025-03-10');
      expect(body.buckets[body.buckets.length - 1]).toEqual('2025-05-26');
    });

    it('should default to months for longer ranges', async () => {
      const wallet = await createWallet();
      const { body } = await series(`walletId=${wallet.id}&startDate=2025-01-15&endDate=2025-12-31`);

      expect(body.interval).toEqual('month');
      expect(body.buckets).toHaveLength(12);
      expect(body.buckets[0]).toEqual('2025-01-01');
      expect(body.buckets[11]).toEqual('2025-12-01');
    });

    it('should take the balance at the end of each week or month', async () => {
      const wallet = await createWallet();
      await createTransaction(wallet.id, '2025-03-04T12:00:00Z', 100);
      await createTransaction(wallet.id, '2025-03-12T12:00:00Z', 50);
      await createTransaction(wallet.id, '2025-04-02T12:00:00Z', 25, 'outcome');

      expect(await balancesOf(wallet.id, 'startDate=2025-03-03&endDate=2025-03-23&interval=week')).toEqual([100, 150, 150]);
      expect(await balancesOf(wallet.id, 'startDate=2025-02-01&endDate=2025-04-30&interval=month')).toEqual([0, 150, 125]);
    });

    it('should not count changes after endDate in the last period', async () => {
      const wallet = await createWallet();
      await createTransaction(wallet.id, '2025-03-04T12:00:00Z', 100);
      await createTransaction(wallet.id, '2025-03-20T12:00:00Z', 50);

      // The March period is cut at the end of 2025-03-10
      expect(await balancesOf(wallet.id, 'startDate=2025-02-01&endDate=2025-03-10&interval=month')).toEqual([0, 100]);
    });
  });

  describe('No activity', () => {
    it('should return a flat zero line for a wallet without entries', async () => {
      const wallet = await createWallet();
      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-01&endDate=2025-03-03`);

      expect(body.series).toEqual([
        { walletId: wallet.id, name: wallet.name, currency: 'BRL', openingBalance: 0, balances: [0, 0, 0] },
      ]);
      expect(body.total).toEqual([0, 0, 0]);
    });

    it('should return a flat line at the opening balance when nothing changes in the range', async () => {
      const wallet = await createWallet();
      await adjust(wallet.id, 300, '2025-01-15T12:00:00Z');

      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-01&endDate=2025-03-03`);
      expect(body.series[0].openingBalance).toEqual(300);
      expect(body.series[0].balances).toEqual([300, 300, 300]);
    });
  });

  describe('Backdated transactions', () => {
    it('should place a transaction on its date, not when it was saved', async () => {
      const wallet = await createWallet();
      await adjust(wallet.id, 1000, '2025-03-01T12:00:00Z');
      await createTransaction(wallet.id, '2025-03-03T12:00:00Z', 200);
      // Saved last, dated before the previous one
      await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 50.25, 'outcome');

      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-01&endDate=2025-03-04&timezone=UTC`);
      expect(body.series[0].openingBalance).toEqual(0);
      expect(body.series[0].balances).toEqual([1000, 949.75, 1149.75, 1149.75]);

      const { body: detail } = await request(app).get(`/api/wallets/${wallet.id}`).set(auth());
      expect(detail.currentBalance).toEqual(1149.75);
    });

    it('should count a transaction dated before startDate in the opening balance', async () => {
      const wallet = await createWallet();
      await createTransaction(wallet.id, '2025-03-05T12:00:00Z', 40);
      await createTransaction(wallet.id, '2025-02-10T12:00:00Z', 60);

      const { body } = await series(`walletId=${wallet.id}&startDate=2025-03-01&endDate=2025-03-06&timezone=UTC`);
      expect(body.series[0].openingBalance).toEqual(60);
      expect(body.series[0].balances).toEqual([60, 60, 60, 60, 100, 100]);
    });

    it('should list history entries by effectiveAt and filter on it', async () => {
      const wallet = await createWallet();
      await adjust(wallet.id, 1000, '2025-03-01T12:00:00Z');
      const later = await createTransaction(wallet.id, '2025-03-03T12:00:00Z', 200);
      const earlier = await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 50, 'outcome');

      const { body } = await request(app).get(`/api/wallets/${wallet.id}/history`).set(auth());
      expect(body.data.map((e: any) => e.effectiveAt)).toEqual([
        '2025-03-03T12:00:00.000Z',
        '2025-03-02T12:00:00.000Z',
        '2025-03-01T12:00:00.000Z',
      ]);
      expect(body.data.map((e: any) => e.transactionId)).toEqual([later.versionId, earlier.versionId, null]);

      const { body: filtered } = await request(app)
        .get(`/api/wallets/${wallet.id}/history?startDate=2025-03-02T00:00:00Z&endDate=2025-03-02T23:59:59Z`)
        .set(auth());
      expect(filtered.data.map((e: any) => e.transactionId)).toEqual([earlier.versionId]);
    });
  });

  describe('Edited transactions', () => {
    const range = 'startDate=2025-03-01&endDate=2025-03-04&timezone=UTC';

    it('should move the balance change when the date is edited', async () => {
      const wallet = await createWallet();
      const transaction = await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 100);
      expect(await balancesOf(wallet.id, range)).toEqual([0, 100, 100, 100]);

      // Same amount: no new entry, the existing one moves
      await request(app)
        .put(`/api/transactions/${transaction.id}`)
        .set(auth())
        .send({ walletId: wallet.id, date: '2025-03-04T12:00:00Z', total: 100, type: 'income', description: 'moved' });
      expect(await balancesOf(wallet.id, range)).toEqual([0, 0, 0, 100]);

      // New amount and date: every entry of the transaction follows the latest date
      await request(app)
        .put(`/api/transactions/${transaction.id}`)
        .set(auth())
        .send({ walletId: wallet.id, date: '2025-03-03T12:00:00Z', total: 150, type: 'income', description: 'moved' });
      expect(await balancesOf(wallet.id, range)).toEqual([0, 0, 150, 150]);

      const { body: history } = await request(app).get(`/api/wallets/${wallet.id}/history`).set(auth());
      expect(history.data.map((e: any) => e.effectiveAt)).toEqual(['2025-03-03T12:00:00.000Z', '2025-03-03T12:00:00.000Z']);
    });

    it('should net to zero in the old wallet when moved to another wallet and date', async () => {
      const walletA = await createWallet();
      const walletB = await createWallet();
      const transaction = await createTransaction(walletA.id, '2025-03-02T12:00:00Z', 100);

      await request(app)
        .put(`/api/transactions/${transaction.id}`)
        .set(auth())
        .send({ walletId: walletB.id, date: '2025-03-04T12:00:00Z', total: 100, type: 'income', description: 'moved' });

      expect(await balancesOf(walletA.id, range)).toEqual([0, 0, 0, 0]);
      expect(await balancesOf(walletB.id, range)).toEqual([0, 0, 0, 100]);
    });

    it('should drop a deleted transaction and bring it back on its date when restored', async () => {
      const wallet = await createWallet();
      const transaction = await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 100);

      await request(app).delete(`/api/transactions/${transaction.id}`).set(auth());
      expect(await balancesOf(wallet.id, range)).toEqual([0, 0, 0, 0]);

      await request(app).patch(`/api/transactions/${transaction.id}/restore`).set(auth());
      expect(await balancesOf(wallet.id, range)).toEqual([0, 100, 100, 100]);
    });

    it('should restore a previous version on its date', async () => {
      const wallet = await createWallet();
      const v1 = await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 100);
      await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send({ walletId: wallet.id, date: '2025-03-04T12:00:00Z', total: 70, type: 'income', description: 'edited' });
      expect(await balancesOf(wallet.id, range)).toEqual([0, 0, 0, 70]);

      await request(app).post(`/api/transactions/${v1.id}/restore/${v1.versionId}`).set(auth());
      expect(await balancesOf(wallet.id, range)).toEqual([0, 100, 100, 100]);
    });
  });

  describe('Time zones', () => {
    // 01:30 UTC on 2025-03-10 is 22:30 on 2025-03-09 in São Paulo (UTC-3)
    const lateEvening = '2025-03-10T01:30:00Z';

    it('should cut days in the given time zone', async () => {
      const wallet = await createWallet();
      await createTransaction(wallet.id, lateEvening, 100);

      const utc = await series(`walletId=${wallet.id}&startDate=2025-03-09&endDate=2025-03-10&timezone=UTC`);
      expect(utc.body.timezone).toEqual('UTC');
      expect(utc.body.series[0].balances).toEqual([0, 100]);

      const saoPaulo = await series(`walletId=${wallet.id}&startDate=2025-03-09&endDate=2025-03-10&timezone=America/Sao_Paulo`);
      expect(saoPaulo.body.timezone).toEqual('America/Sao_Paulo');
      expect(saoPaulo.body.series[0].balances).toEqual([100, 100]);
    });

    it('should use the time zone for the opening balance', async () => {
      const wallet = await createWallet();
      await createTransaction(wallet.id, lateEvening, 100);

      const utc = await series(`walletId=${wallet.id}&startDate=2025-03-10&endDate=2025-03-10&timezone=UTC`);
      expect(utc.body.series[0].openingBalance).toEqual(0);

      const saoPaulo = await series(`walletId=${wallet.id}&startDate=2025-03-10&endDate=2025-03-10&timezone=America/Sao_Paulo`);
      expect(saoPaulo.body.series[0].openingBalance).toEqual(100);
    });
  });

  describe('Wallet selection and total', () => {
    let token: string;
    let brlA: any;
    let brlB: any;
    let usd: any;
    let deleted: any;
    const range = 'startDate=2025-03-01&endDate=2025-03-02&timezone=UTC';

    // A separate user, so the default selection only sees these wallets
    beforeAll(async () => {
      const user = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user);
      const { body } = await request(app).post('/api/sessions').send({ username: user.username, password: user.password });
      token = body.token;

      brlA = await createWallet('BRL', token);
      brlB = await createWallet('BRL', token);
      usd = await createWallet('USD', token);
      deleted = await createWallet('BRL', token);

      const withToken = (walletId: string, amount: number) =>
        request(app)
          .post(`/api/wallets/${walletId}/adjust`)
          .set(auth(token))
          .send({ amount, recordedAt: '2025-03-02T12:00:00Z' });
      await withToken(brlA.id, 100);
      await withToken(brlB.id, 50.5);
      await withToken(usd.id, 10);
      await withToken(deleted.id, 999);
      await request(app).delete(`/api/wallets/${deleted.id}`).set(auth(token));
    });

    it('should include all active wallets and no total when currencies differ', async () => {
      const { body } = await series(range, token);

      expect(body.series.map((s: any) => s.walletId)).toEqual([brlA.id, brlB.id, usd.id]);
      expect(body.total).toBeNull();
    });

    it('should include only wallets of the X-Currency and sum them', async () => {
      const { body } = await request(app)
        .get(`/api/wallets/balance-series?${range}`)
        .set({ ...auth(token), 'X-Currency': 'BRL' });

      expect(body.series.map((s: any) => s.walletId)).toEqual([brlA.id, brlB.id]);
      expect(body.total).toEqual([0, 150.5]);
    });

    it('should include a soft-deleted wallet when asked for by id', async () => {
      const { body, status } = await series(`walletId=${deleted.id}&walletId=${brlA.id}&${range}`, token);

      expect(status).toEqual(200);
      expect(body.series.map((s: any) => s.walletId).sort()).toEqual([brlA.id, deleted.id].sort());
      expect(body.total).toEqual([0, 1099]);
    });

    it("should return 404 for another user's wallet", async () => {
      const own = await createWallet();
      const { status } = await series(`walletId=${own.id}&${range}`, token);
      expect(status).toEqual(404);
    });
  });
});

describe('Repair of the balance entry chain (migration)', () => {
  const history = async (walletId: string) =>
    (await request(app).get(`/api/wallets/${walletId}/history?limit=100`).set(auth())).body.data;

  const endOfToday = async (walletId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { body } = await series(`walletId=${walletId}&startDate=${today}&endDate=${today}&timezone=UTC`);
    return body.series[0].balances[0];
  };

  it('should make the series agree with the balance after an entry was saved from a stale balance', async () => {
    const wallet = await createWallet();
    await request(app).post(`/api/wallets/${wallet.id}/adjust`).set(auth()).send({ amount: 1000 });
    await createTransaction(wallet.id, '2025-03-02T12:00:00Z', 100, 'outcome');
    const stale = await createTransaction(wallet.id, '2025-03-03T12:00:00Z', 50, 'outcome');

    // What the race left behind: the second entry computed from the balance before the first one
    await dataSource.query('UPDATE wallet_snapshots SET amount = 950 WHERE transactionId = ?', [stale.versionId]);
    // A later correction to the real balance takes its delta from the wrong amount (800 - 950)
    await request(app).post(`/api/wallets/${wallet.id}/adjust`).set(auth()).send({ amount: 800 });
    expect(await endOfToday(wallet.id)).toEqual(700);

    const untouched = await createWallet();
    await request(app).post(`/api/wallets/${untouched.id}/adjust`).set(auth()).send({ amount: 300 });
    await createTransaction(untouched.id, '2025-03-02T12:00:00Z', 20);
    const untouchedBefore = await history(untouched.id);

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new RepairWalletSnapshotChain1790812800000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    expect(await endOfToday(wallet.id)).toEqual(800);
    const { body: detail } = await request(app).get(`/api/wallets/${wallet.id}`).set(auth());
    expect(detail.currentBalance).toEqual(800);

    const entries = await history(wallet.id);
    expect(entries.find((e: any) => e.transactionId === stale.versionId)).toMatchObject({ amount: 850, delta: -50 });
    expect(entries.find((e: any) => e.source === 'manual' && e.amount === 800)).toMatchObject({ delta: -50 });

    expect(await history(untouched.id)).toEqual(untouchedBefore);
  });
});
