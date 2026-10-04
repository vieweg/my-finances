import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { adminUserCredentials, SessionResponseDto } from './global/setupTests';
import app from '../src/app';

let session: SessionResponseDto;

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

const auth = () => ({ Authorization: `Bearer ${session.token}` });

// Marks this suite's transactions so assertions don't depend on data created by other suites
const runMarker = `currency-filter-${Date.now()}`;

const createTransaction = (currency: 'BRL' | 'GBP') =>
  request(app)
    .post('/api/transactions')
    .set(auth())
    .send({
      date: new Date().toISOString(),
      total: 100,
      currency,
      description: `${currency} transaction ${runMarker}`,
      type: 'income',
    });

const createWallet = (currency: 'BRL' | 'GBP') =>
  request(app)
    .post('/api/wallets')
    .set(auth())
    .send({ name: `${currency} wallet`, currency });

describe('X-Currency header filter', () => {
  describe('Validation', () => {
    it('should return 400 for an invalid X-Currency value', async () => {
      const { status, body } = await request(app)
        .get('/api/transactions')
        .set({ ...auth(), 'x-currency': 'INVALID' });

      expect(status).toEqual(400);
      expect(body.message).toMatch(/Invalid X-Currency/);
    });

    it('should ignore the header on routes that do not use it (tags)', async () => {
      const { status } = await request(app)
        .get('/api/tags')
        .set({ ...auth(), 'x-currency': 'USD' });

      expect(status).toEqual(200);
    });
  });

  describe('Transactions', () => {
    beforeAll(async () => {
      await Promise.all([
        createTransaction('BRL'),
        createTransaction('BRL'),
        createTransaction('GBP'),
      ]);
    });

    it('should return only BRL transactions when X-Currency is BRL', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions')
        .set({ ...auth(), 'x-currency': 'BRL' });

      expect(status).toEqual(200);
      expect(body.every((t: any) => t.total.currency === 'BRL')).toBe(true);
    });

    it('should return only GBP transactions when X-Currency is GBP', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/transactions')
        .set({ ...auth(), 'x-currency': 'GBP' });

      expect(status).toEqual(200);
      expect(body.every((t: any) => t.total.currency === 'GBP')).toBe(true);
    });

    it('should return all transactions when no header is set', async () => {
      const { body: { data: body } } = await request(app).get(`/api/transactions?description=${runMarker}`).set(auth());
      const currencies = new Set(body.map((t: any) => t.total.currency));

      expect(currencies.has('BRL')).toBe(true);
      expect(currencies.has('GBP')).toBe(true);
    });

    it('should return 400 when both filterByCurrency query param and X-Currency header are provided', async () => {
      const { status } = await request(app)
        .get('/api/transactions?filterByCurrency=GBP')
        .set({ ...auth(), 'x-currency': 'BRL' });

      expect(status).toEqual(400);
    });
  });

  describe('Wallets', () => {
    beforeAll(async () => {
      await Promise.all([createWallet('BRL'), createWallet('GBP')]);
    });

    it('should return only BRL wallets when X-Currency is BRL', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/wallets')
        .set({ ...auth(), 'x-currency': 'BRL' });

      expect(status).toEqual(200);
      expect(body.every((w: any) => w.currency === 'BRL')).toBe(true);
    });

    it('should return only GBP wallets when X-Currency is GBP', async () => {
      const { body: { data: body }, status } = await request(app)
        .get('/api/wallets')
        .set({ ...auth(), 'x-currency': 'GBP' });

      expect(status).toEqual(200);
      expect(body.every((w: any) => w.currency === 'GBP')).toBe(true);
    });

    it('should return all wallets when no header is set', async () => {
      const { body: { data: body } } = await request(app).get('/api/wallets').set(auth());
      const currencies = new Set(body.map((w: any) => w.currency));

      expect(currencies.has('BRL')).toBe(true);
      expect(currencies.has('GBP')).toBe(true);
    });

    it('should let the query param override the header', async () => {
      const { body: { data: body } } = await request(app)
        .get('/api/wallets?currency=GBP')
        .set({ ...auth(), 'x-currency': 'BRL' });

      expect(body.every((w: any) => w.currency === 'GBP')).toBe(true);
    });
  });
});
