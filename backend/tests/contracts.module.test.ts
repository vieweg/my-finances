import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, SessionResponseDto } from './global/setupTests';
import { dataSource } from '../src/database';
import { FixDeletedContractsStatus1790467200000 } from '../src/database/migrations/1790467200000-fix_deleted_contracts_status';
import app from '../src/app';

let session: SessionResponseDto;
let contactId: string;

const auth = () => ({ Authorization: `Bearer ${session.token}` });

const firstDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const buildPayload = (overrides?: object) => ({
  contactId,
  type: 'receivable',
  amount: 500,
  currency: 'BRL',
  description: faker.lorem.sentence(),
  instalments: 3,
  cycleMonths: 1,
  firstDueDate,
  name: faker.company.name(),
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

describe('Contracts', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/contracts');
      expect(res.status).toEqual(401);
    });
  });

  describe('CRUD', () => {
    it('should create a contract and generate first invoice when firstDueDate is now', async () => {
      const { body, status } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ firstDueDate: new Date().toISOString(), instalments: 3 }));

      expect(status).toEqual(201);
      expect(body.instalmentsDone).toEqual(1);

      const { body: detail } = await request(app).get(`/api/contracts/${body.id}`).set(auth());
      expect(detail.invoices).toHaveLength(1);
    });

    it('should create a contract', async () => {
      const { body, status } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());

      expect(status).toEqual(201);
      expect(body).toMatchObject({
        id: expect.any(String),
        type: 'receivable',
        status: 'active',
        instalments: 3,
        instalmentsDone: 0,
        cycleMonths: 1,
        total: { amount: 500, currency: 'BRL' },
        contact: expect.objectContaining({ id: contactId }),
      });
      expect(new Date(body.nextDueDate).toISOString()).toEqual(new Date(firstDueDate).toISOString());
    });

    it('should return 400 when currency is provided with walletId', async () => {
      const { body: wallet } = await request(app)
        .post('/api/wallets')
        .set(auth())
        .send({ name: 'Test Wallet', currency: 'BRL' });

      const { status } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ walletId: wallet.id, currency: 'BRL' }));

      expect(status).toEqual(400);
    });

    it('should return 400 for cycleMonths outside 1–12', async () => {
      const { status } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ cycleMonths: 13 }));
      expect(status).toEqual(400);
    });

    it('should return 404 when contact does not exist', async () => {
      const { status } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ contactId: faker.string.uuid() }));
      expect(status).toEqual(404);
    });

    it('should list contracts', async () => {
      await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const { body: { data: body }, status } = await request(app).get('/api/contracts').set(auth());
      expect(status).toEqual(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should filter contracts by status', async () => {
      const { body: { data: list }, status } = await request(app)
        .get('/api/contracts?filterByStatus=active')
        .set(auth());
      expect(status).toEqual(200);
      expect(list.every((c: any) => c.status === 'active')).toBe(true);
    });

    it('should filter contracts by currency', async () => {
      await request(app).post('/api/contracts').set(auth()).send(buildPayload({ currency: 'USD' }));
      const { body: { data: list }, status } = await request(app)
        .get('/api/contracts?filterByCurrency=BRL')
        .set(auth());
      expect(status).toEqual(200);
      expect(list.every((c: any) => c.total.currency === 'BRL')).toBe(true);
    });

    it('should filter contracts by currency via X-Currency header', async () => {
      const { body: { data: list }, status } = await request(app)
        .get('/api/contracts')
        .set({ ...auth(), 'X-Currency': 'BRL' });
      expect(status).toEqual(200);
      expect(list.every((c: any) => c.total.currency === 'BRL')).toBe(true);
    });

    it('should return 400 when filterByCurrency and X-Currency header are both set', async () => {
      const { status } = await request(app)
        .get('/api/contracts?filterByCurrency=BRL')
        .set({ ...auth(), 'X-Currency': 'USD' });
      expect(status).toEqual(400);
    });

    it('should list only soft-deleted contracts when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());

      const { body: { data: list }, status } = await request(app)
        .get('/api/contracts?deleted=true')
        .set(auth());
      expect(status).toEqual(200);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((c: any) => c.deletedAt !== undefined)).toBe(true);
    });

    it('should persist the cancelled status when a contract is deleted', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const { body: deleteResponse } = await request(app).delete(`/api/contracts/${created.id}`).set(auth());
      expect(deleteResponse.status).toEqual('cancelled');

      const { body } = await request(app).get(`/api/contracts/${created.id}?deleted=true`).set(auth());
      expect(body.status).toEqual('cancelled');
      expect(body.deletedAt).toBeDefined();
    });

    it('migration should set the status of contracts deleted before the fix to cancelled', async () => {
      const { body: deleted } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const { body: active } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      // What the old delete left behind: soft-deleted but still active
      await dataSource.query(`UPDATE contracts SET status = 'active', deletedAt = NOW() WHERE id = ?`, [deleted.id]);

      const queryRunner = dataSource.createQueryRunner();
      try {
        await new FixDeletedContractsStatus1790467200000().up(queryRunner);
      } finally {
        await queryRunner.release();
      }

      const { body: deletedAfter } = await request(app).get(`/api/contracts/${deleted.id}?deleted=true`).set(auth());
      expect(deletedAfter.status).toEqual('cancelled');
      const { body: activeAfter } = await request(app).get(`/api/contracts/${active.id}`).set(auth());
      expect(activeAfter.status).toEqual('active');
    });

    it('should get a soft-deleted contract with its invoices when deleted=true', async () => {
      const { body: created } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ firstDueDate: new Date().toISOString() }));
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());

      const { body, status } = await request(app).get(`/api/contracts/${created.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.deletedAt).toBeDefined();
      expect(body.invoices).toHaveLength(1);
    });

    it('should return 404 for a soft-deleted contract without deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());

      const { status } = await request(app).get(`/api/contracts/${created.id}`).set(auth());
      expect(status).toEqual(404);
    });

    it('should get an active contract when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());

      const { body, status } = await request(app).get(`/api/contracts/${created.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.deletedAt).toBeUndefined();
    });

    describe('Filtering', () => {
      let filteredContractId: string;
      let filterContactId: string;
      const uniqueDesc = 'UniqueContractDesc_Xyz789';

      beforeAll(async () => {
        const { body: contact } = await request(app)
          .post('/api/contacts')
          .set(auth())
          .send({ name: 'FilterableContractContact SpecialUser' });
        filterContactId = contact.id;

        const { body: contract } = await request(app)
          .post('/api/contracts')
          .set(auth())
          .send(buildPayload({ contactId: filterContactId, description: uniqueDesc }));
        filteredContractId = contract.id;
      });

      it('should filter contracts by description (partial match)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?description=UniqueContractDesc')
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((c: any) => c.id === filteredContractId)).toBe(true);
        expect(body.every((c: any) => c.description?.toLowerCase().includes('uniquecontractdesc'))).toBe(true);
      });

      it('should return no results when description does not match', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?description=NOMATCH_DESCRIPTION_XYZ')
          .set(auth());

        expect(status).toEqual(200);
        expect(body).toHaveLength(0);
      });

      it('should filter contracts by contact name (partial match)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?filterByContactName=FilterableContractContact')
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((c: any) => c.id === filteredContractId)).toBe(true);
        expect(body.every((c: any) => c.contact.name.toLowerCase().includes('filterablecontractcontact'))).toBe(true);
      });

      it('should return no results when contact name does not match', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?filterByContactName=NoSuchContactXYZ')
          .set(auth());

        expect(status).toEqual(200);
        expect(body).toHaveLength(0);
      });

      it('should match contracts by description via search (OR)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?search=UniqueContractDesc')
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((c: any) => c.id === filteredContractId)).toBe(true);
      });

      it('should match contracts by contact name via search (OR)', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?search=FilterableContractContact')
          .set(auth());

        expect(status).toEqual(200);
        expect(body.some((c: any) => c.id === filteredContractId)).toBe(true);
      });

      it('should return no results when search matches neither description nor contact name', async () => {
        const { body: { data: body }, status } = await request(app)
          .get('/api/contracts?search=NOMATCH_SEARCH_XYZ')
          .set(auth());

        expect(status).toEqual(200);
        expect(body).toHaveLength(0);
      });
    });

    it('should get a contract by id with empty invoices list', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const { body, status } = await request(app).get(`/api/contracts/${created.id}`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(Array.isArray(body.invoices)).toBe(true);
      expect(body.invoices).toHaveLength(0);
    });

    it('should update a contract name and description', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const newName = faker.company.name();
      const { body, status } = await request(app)
        .put(`/api/contracts/${created.id}`)
        .set(auth())
        .send({ name: newName, description: 'updated' });
      expect(status).toEqual(200);
      expect(body.name).toEqual(newName);
      expect(body.description).toEqual('updated');
    });

    it('should return 400 when updating a cancelled contract', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());
      const { status } = await request(app)
        .put(`/api/contracts/${created.id}`)
        .set(auth())
        .send({ name: 'new name' });
      expect(status).toEqual(400);
    });

    it('should soft-delete (cancel) a contract', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      const { body, status } = await request(app).delete(`/api/contracts/${created.id}`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('cancelled');
      expect(body.deletedAt).toBeDefined();
    });
  });

  describe('Generate invoices', () => {
    it('should generate one invoice and advance instalmentsDone and nextDueDate', async () => {
      const { body: contract } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());

      const { body: result, status } = await request(app)
        .post(`/api/contracts/${contract.id}/generate`)
        .set(auth());

      expect(status).toEqual(200);
      expect(result).toMatchObject({ generated: 1 });

      // Contract state should have advanced
      const { body: updated } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(updated.instalmentsDone).toEqual(1);
      expect(new Date(updated.nextDueDate) > new Date(firstDueDate)).toBe(true);
      expect(updated.invoices).toHaveLength(1);
      expect(updated.invoices[0].total).toMatchObject({ amount: 500, currency: 'BRL' });
    });

    it('should list the contract invoices by due date, most recent first', async () => {
      const { body: contract } = await request(app).post('/api/contracts').set(auth()).send(buildPayload({ instalments: 0 }));
      for (let i = 0; i < 3; i++) {
        await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());
      }

      const { body } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      const dueDates = body.invoices.map((inv: any) => new Date(inv.dueDate).getTime());
      expect(dueDates).toHaveLength(3);
      expect(dueDates).toEqual([...dueDates].sort((a, b) => b - a));
    });

    it('should mark contract completed when all instalments are done', async () => {
      const { body: contract } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ instalments: 1 }));

      await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());

      const { body: updated } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(updated.status).toEqual('completed');
      expect(updated.instalmentsDone).toEqual(1);
    });

    it('should return 400 when generating for a non-active contract', async () => {
      const { body: contract } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contracts/${contract.id}`).set(auth());

      const { status } = await request(app)
        .post(`/api/contracts/${contract.id}/generate`)
        .set(auth());
      expect(status).toEqual(400);
    });

    it('generated invoice should appear in GET /api/invoices filtered by contractId', async () => {
      const { body: contract } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());

      const { body: { data: invoices }, status } = await request(app)
        .get(`/api/invoices?contractId=${contract.id}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].contractId).toEqual(contract.id);
      expect(invoices[0].dueDate).toBeDefined();
    });

    it('recurrent contract (instalments=0) should not complete after generate', async () => {
      const { body: contract } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ instalments: 0 }));

      await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());

      const { body: updated } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(updated.status).toEqual('active');
      expect(updated.instalmentsDone).toEqual(1);
    });
  });

  describe('Restore', () => {
    it('should restore a soft-deleted contract as active', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/contracts/${created.id}/restore`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.status).toEqual('active');
      expect(body.deletedAt).toBeUndefined();
      expect(Array.isArray(body.invoices)).toBe(true);

      const { status: getStatus } = await request(app).get(`/api/contracts/${created.id}`).set(auth());
      expect(getStatus).toEqual(200);
    });

    it('should restore a contract with all instalments generated as completed', async () => {
      const { body: created } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ instalments: 1, firstDueDate: new Date().toISOString() }));
      await request(app).delete(`/api/contracts/${created.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/contracts/${created.id}/restore`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('completed');
    });

    it('should return 400 when restoring a contract that is not deleted', async () => {
      const { body: created } = await request(app).post('/api/contracts').set(auth()).send(buildPayload());

      const { status } = await request(app).patch(`/api/contracts/${created.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 404 when restoring an unknown contract', async () => {
      const { status } = await request(app).patch(`/api/contracts/${faker.string.uuid()}/restore`).set(auth());
      expect(status).toEqual(404);
    });
  });

  describe('Status lifecycle', () => {
    let lifecycleContactId: string;
    const byContact = () => `filterByContactId=${lifecycleContactId}`;
    const createContract = (overrides?: object) =>
      request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ contactId: lifecycleContactId, ...overrides }))
        .then((r) => r.body);
    // instalments: 1 with a due date of now generates the only invoice on creation, so it is completed
    const createCompleted = () => createContract({ instalments: 1, firstDueDate: new Date().toISOString() });

    beforeAll(async () => {
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      lifecycleContactId = contact.id;
    });

    it('should list only active contracts by default and include completed ones on request', async () => {
      const active = await createContract();
      const completed = await createCompleted();
      const cancelled = await createContract();
      await request(app).delete(`/api/contracts/${cancelled.id}`).set(auth());
      expect(completed.status).toEqual('completed');

      const ids = (body: any[]) => body.map((c) => c.id);

      const { body: { data: byDefault } } = await request(app).get(`/api/contracts?${byContact()}`).set(auth());
      expect(ids(byDefault)).toContain(active.id);
      expect(ids(byDefault)).not.toContain(completed.id);
      expect(ids(byDefault)).not.toContain(cancelled.id);

      const { body: { data: withCompleted } } = await request(app)
        .get(`/api/contracts?${byContact()}&includeCompleted=true`)
        .set(auth());
      expect(ids(withCompleted)).toEqual(expect.arrayContaining([active.id, completed.id]));
      expect(ids(withCompleted)).not.toContain(cancelled.id);

      const { body: { data: onlyCompleted } } = await request(app)
        .get(`/api/contracts?${byContact()}&filterByStatus=completed`)
        .set(auth());
      expect(onlyCompleted.every((c: any) => c.status === 'completed')).toBe(true);
      expect(ids(onlyCompleted)).toContain(completed.id);

      const { body: { data: deleted } } = await request(app).get(`/api/contracts?${byContact()}&deleted=true`).set(auth());
      expect(ids(deleted)).toEqual([cancelled.id]);
    });

    it('should complete a recurring contract without deleting it', async () => {
      const contract = await createContract({ instalments: 0 });

      const { body, status } = await request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('completed');
      expect(body.deletedAt).toBeUndefined();

      const { status: generateStatus } = await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());
      expect(generateStatus).toEqual(400);
    });

    it('should complete a contract before all its instalments were generated', async () => {
      const contract = await createContract({ instalments: 6 });

      const { body, status } = await request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('completed');
      expect(body.instalmentsDone).toEqual(0);
    });

    it('should return 400 when completing a contract that is not active', async () => {
      const completed = await createCompleted();
      const { status } = await request(app).patch(`/api/contracts/${completed.id}/complete`).set(auth());
      expect(status).toEqual(400);
    });

    it('should reactivate a contract completed early', async () => {
      const contract = await createContract({ instalments: 0 });
      await request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth());

      const { body, status } = await request(app).patch(`/api/contracts/${contract.id}/reactivate`).set(auth());
      expect(status).toEqual(200);
      expect(body.status).toEqual('active');
    });

    it('should return 400 when reactivating a contract that generated all its instalments', async () => {
      const completed = await createCompleted();
      const { status } = await request(app).patch(`/api/contracts/${completed.id}/reactivate`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 when reactivating a contract that is not completed', async () => {
      const contract = await createContract();
      const { status } = await request(app).patch(`/api/contracts/${contract.id}/reactivate`).set(auth());
      expect(status).toEqual(400);
    });

    it('should reopen a completed contract when its instalments are increased', async () => {
      const completed = await createCompleted();

      const { body, status } = await request(app)
        .put(`/api/contracts/${completed.id}`)
        .set(auth())
        .send({ instalments: 3 });
      expect(status).toEqual(200);
      expect(body.status).toEqual('active');
    });

    it('should keep a manually completed contract completed on other edits', async () => {
      const contract = await createContract({ instalments: 6 });
      await request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth());

      const { body } = await request(app)
        .put(`/api/contracts/${contract.id}`)
        .set(auth())
        .send({ name: 'renamed', instalments: 6 });
      expect(body.status).toEqual('completed');
    });
  });

  describe('Sort by amount', () => {
    it('should sort signed: receivables positive, payables negative', async () => {
      const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
      const specs: Array<[string, number]> = [['payable', 100], ['receivable', 50], ['receivable', 300], ['payable', 20]];
      for (const [type, amount] of specs) {
        await request(app).post('/api/contracts').set(auth()).send(buildPayload({ contactId: contact.id, type, amount }));
      }
      const signed = (body: any[]) => body.map((c) => (c.type === 'payable' ? -1 : 1) * c.total.amount);

      const { body: { data: desc } } = await request(app)
        .get(`/api/contracts?filterByContactId=${contact.id}&sortBy=amount&sortOrder=desc`)
        .set(auth());
      expect(signed(desc)).toEqual([300, 50, -20, -100]);

      const { body: { data: asc } } = await request(app)
        .get(`/api/contracts?filterByContactId=${contact.id}&sortBy=amount&sortOrder=asc`)
        .set(auth());
      expect(signed(asc)).toEqual([-100, -20, 50, 300]);
    });
  });
});

describe('Contracts — wallet, notes and paid amounts', () => {
  const createWallet = async () => {
    const { body } = await request(app)
      .post('/api/wallets')
      .set(auth())
      .send({ name: `wallet-${faker.string.alphanumeric(10)}`, currency: 'BRL' });
    return body;
  };

  const createContract = async (overrides?: object) => {
    const { body } = await request(app).post('/api/contracts').set(auth()).send(buildPayload(overrides));
    return body;
  };

  describe('Embedded wallet', () => {
    it('should embed the wallet and keep walletId', async () => {
      const wallet = await createWallet();
      const contract = await createContract({ walletId: wallet.id, currency: undefined });

      expect(contract.walletId).toEqual(wallet.id);
      expect(contract.wallet).toEqual({ id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: null });

      const withoutWallet = await createContract();
      expect(withoutWallet.wallet).toBeNull();
    });

    it('should still embed the wallet after it is soft-deleted, on list and detail', async () => {
      const wallet = await createWallet();
      const name = `deleted-wallet-${faker.string.alphanumeric(10)}`;
      const contract = await createContract({ walletId: wallet.id, currency: undefined, name });

      await request(app).delete(`/api/wallets/${wallet.id}`).set(auth());

      const expected = { id: wallet.id, name: wallet.name, currency: 'BRL', deletedAt: expect.any(String) };

      const { body: detail } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(detail.walletId).toEqual(wallet.id);
      expect(detail.wallet).toEqual(expected);

      const { body: list } = await request(app).get(`/api/contracts?name=${name}`).set(auth());
      expect(list.data).toHaveLength(1);
      expect(list.data[0].wallet).toEqual(expected);
    });
  });

  describe('Notes', () => {
    it('should create, update and clear notes', async () => {
      const contract = await createContract({ notes: 'renew in March' });
      expect(contract.notes).toEqual('renew in March');

      const { body: updated } = await request(app)
        .put(`/api/contracts/${contract.id}`)
        .set(auth())
        .send({ notes: 'renewed' });
      expect(updated.notes).toEqual('renewed');

      const { body: detail } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(detail.notes).toEqual('renewed');

      const { body: cleared } = await request(app).put(`/api/contracts/${contract.id}`).set(auth()).send({ notes: null });
      expect(cleared.notes).toBeNull();

      const withoutNotes = await createContract();
      expect(withoutNotes.notes).toBeNull();
    });

    it('should return 400 when notes are longer than 2000 characters', async () => {
      const { status } = await request(app)
        .post('/api/contracts')
        .set(auth())
        .send(buildPayload({ notes: 'a'.repeat(2001) }));
      expect(status).toEqual(400);
    });

    it('should match notes via search', async () => {
      const marker = faker.string.alphanumeric(12);
      const contract = await createContract({ notes: `see ${marker}` });

      const { body } = await request(app).get(`/api/contracts?search=${marker}`).set(auth());
      expect(body.data.map((c: any) => c.id)).toEqual([contract.id]);
    });
  });

  describe('Paid amounts', () => {
    const pay = (invoiceId: string, total: number) =>
      request(app)
        .post(`/api/invoices/${invoiceId}/transactions`)
        .set(auth())
        .send({ date: new Date().toISOString(), total, description: 'payment' });

    it('should show paid and outstanding amounts per invoice and contract totals', async () => {
      const contract = await createContract({ amount: 500, instalments: 4 });
      for (let i = 0; i < 4; i++) {
        await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());
      }

      const { body: before } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(before.invoices).toHaveLength(4);
      for (const invoice of before.invoices) {
        expect(invoice.paidAmount).toEqual({ amount: 0, currency: 'BRL' });
        expect(invoice.outstanding).toEqual({ amount: 500, currency: 'BRL' });
      }

      // Invoices are newest first: [fourth, third, second, first]
      const [fourth, third, second, first] = before.invoices.map((inv: any) => inv.id);
      await pay(first, 500);
      await pay(second, 200.5);
      await pay(second, 0.25);
      await request(app).patch(`/api/invoices/${third}/mark-paid`).set(auth());
      await request(app).delete(`/api/invoices/${fourth}`).set(auth());

      const { body } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      const byId = Object.fromEntries(body.invoices.map((inv: any) => [inv.id, inv]));

      expect(body.invoices).toHaveLength(3);
      expect(byId[first]).toMatchObject({
        status: 'paid',
        paidAmount: { amount: 500, currency: 'BRL' },
        outstanding: { amount: 0, currency: 'BRL' },
      });
      expect(byId[second]).toMatchObject({
        status: 'partial',
        paidAmount: { amount: 200.75, currency: 'BRL' },
        outstanding: { amount: 299.25, currency: 'BRL' },
      });
      // Marked paid without payments: nothing paid, nothing owed
      expect(byId[third]).toMatchObject({
        status: 'paid',
        paidAmount: { amount: 0, currency: 'BRL' },
        outstanding: { amount: 0, currency: 'BRL' },
      });

      // The cancelled (deleted) invoice is left out of the totals
      expect(body.totalInvoiced).toEqual({ amount: 1500, currency: 'BRL' });
      expect(body.totalPaid).toEqual({ amount: 700.75, currency: 'BRL' });
      expect(body.totalOutstanding).toEqual({ amount: 299.25, currency: 'BRL' });
    });

    it('should ignore deleted payments', async () => {
      const contract = await createContract({ amount: 500, instalments: 1 });
      await request(app).post(`/api/contracts/${contract.id}/generate`).set(auth());
      const { body: before } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      const invoiceId = before.invoices[0].id;

      const { body: paid } = await pay(invoiceId, 300);
      await request(app).delete(`/api/transactions/${paid.transactions[0].id}`).set(auth());

      const { body } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(body.invoices[0].paidAmount).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.invoices[0].outstanding).toEqual({ amount: 500, currency: 'BRL' });
      expect(body.totalPaid).toEqual({ amount: 0, currency: 'BRL' });
    });

    it('should return zero totals for a contract without invoices', async () => {
      const contract = await createContract();

      const { body } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(body.invoices).toEqual([]);
      expect(body.totalInvoiced).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.totalPaid).toEqual({ amount: 0, currency: 'BRL' });
      expect(body.totalOutstanding).toEqual({ amount: 0, currency: 'BRL' });
    });

    it('should not include totals in the list', async () => {
      const name = `no-totals-${faker.string.alphanumeric(10)}`;
      await createContract({ name });

      const { body } = await request(app).get(`/api/contracts?name=${name}`).set(auth());
      expect(body.data[0]).not.toHaveProperty('totalInvoiced');
      expect(body.data[0]).not.toHaveProperty('invoices');
    });
  });
});
