import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import { adminUserCredentials, SessionResponseDto, buildCreateUserPayload } from './global/setupTests';
import { dataSource } from '../src/database';
import { Tag } from '../src/modules/tags/models/tags.model';
import app from '../src/app';

let session: SessionResponseDto;
let contactId: string;
let adminToken: string;

const auth = () => ({ Authorization: `Bearer ${session.token}` });

// The API refuses to create tags with a name that already exists, so duplicates
// (as produced by concurrent requests or imports) are inserted directly.
const insertTag = async (name: string, userId = session.user.id) =>
  dataSource.getRepository(Tag).save({ name, user: { id: userId } });

const uniqueName = (base: string) => `${base} ${faker.string.alphanumeric(8)}`;

const tagRef = (tag: Tag) => ({ id: tag.id, name: tag.name });

const buildTransaction = (overrides?: object) => ({
  date: new Date().toISOString(),
  total: 100,
  currency: 'BRL',
  description: faker.lorem.sentence(),
  type: 'outcome',
  ...overrides,
});

const createUserSession = async (token: string): Promise<SessionResponseDto> => {
  const user = buildCreateUserPayload();
  await request(app).post('/api/users').set({ Authorization: `Bearer ${token}` }).send(user);
  const { body } = await request(app).post('/api/sessions').send({ username: user.username, password: user.password });
  return body;
};

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body: admin } = await request(app).post('/api/sessions').send({ username, password });
  // A dedicated user keeps the duplicated names out of the admin's tag list used by other suites
  adminToken = admin.token;
  session = await createUserSession(adminToken);

  const { body: contact } = await request(app).post('/api/contacts').set(auth()).send({ name: faker.person.fullName() });
  contactId = contact.id;
});

describe('Tag deduplication', () => {
  describe('GET /api/tags/duplicates', () => {
    it('should group tags that only differ by accents, case or whitespace', async () => {
      const base = uniqueName('Tarifas Bancárias');
      const a = await insertTag(base);
      const b = await insertTag(base.replace('á', 'a').toUpperCase());
      const c = await insertTag(`  ${base.replace(' ', '   ')} `);

      const { body, status } = await request(app).get('/api/tags/duplicates').set(auth());
      expect(status).toEqual(200);

      const group = body.find((g: any) => g.tags.some((t: any) => t.id === a.id));
      expect(group).toBeDefined();
      expect(group.tags.map((t: any) => t.id).sort()).toEqual([a.id, b.id, c.id].sort());
      expect(group.tags[0].usage).toEqual({ transactions: 0, invoices: 0, contracts: 0 });
    });

    it('should list the most used tag first', async () => {
      const name = uniqueName('Cursos');
      const older = await insertTag(name);
      const used = await insertTag(name);
      await request(app).post('/api/transactions').set(auth()).send(buildTransaction({ tags: [tagRef(used)] }));

      const { body } = await request(app).get('/api/tags/duplicates').set(auth());
      const group = body.find((g: any) => g.tags.some((t: any) => t.id === older.id));
      expect(group.tags[0].id).toEqual(used.id);
      expect(group.tags[0].usage.transactions).toEqual(1);
      expect(group.tags[1].id).toEqual(older.id);
    });

    it('should not report unique, soft-deleted or other users\' tags', async () => {
      const name = uniqueName('Gasolina');
      const mine = await insertTag(name);
      const deleted = await insertTag(name);
      await dataSource.getRepository(Tag).softRemove(deleted);

      const user2Session = await createUserSession(adminToken);
      await insertTag(name, user2Session.user.id);

      const { body } = await request(app).get('/api/tags/duplicates').set(auth());
      expect(body.every((g: any) => g.tags.every((t: any) => t.id !== mine.id))).toBe(true);
    });
  });

  describe('POST /api/tags/merge', () => {
    it('should move transaction, invoice and contract links to the target and soft-delete the sources', async () => {
      const name = uniqueName('Entradas Diversas');
      const target = await insertTag(name);
      const source = await insertTag(name);

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send(buildTransaction({ tags: [tagRef(source)] }));
      const { body: invoice } = await request(app).post('/api/invoices').set(auth()).send({
        contactId,
        type: 'payable',
        amount: 300,
        currency: 'BRL',
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: faker.lorem.sentence(),
        tags: [tagRef(source)],
      });
      const { body: contract } = await request(app).post('/api/contracts').set(auth()).send({
        name: faker.company.name(),
        contactId,
        type: 'payable',
        amount: 300,
        currency: 'BRL',
        description: faker.lorem.sentence(),
        instalments: 2,
        cycleMonths: 1,
        firstDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        tags: [tagRef(source)],
      });

      const { body, status } = await request(app)
        .post('/api/tags/merge')
        .set(auth())
        .send({ targetId: target.id, sourceIds: [source.id] });

      expect(status).toEqual(200);
      expect(body.mergedIds).toEqual([source.id]);
      expect(body.tag.id).toEqual(target.id);
      expect(body.tag.usage).toEqual({ transactions: 1, invoices: 1, contracts: 1 });

      // updatedAt is bumped because the records' tags changed
      const { body: txDetail } = await request(app).get(`/api/transactions/${tx.id}`).set(auth());
      expect(txDetail.tags.map((t: any) => t.id)).toEqual([target.id]);
      expect(new Date(txDetail.updatedAt).getTime()).toBeGreaterThan(new Date(tx.updatedAt).getTime());
      const { body: invoiceDetail } = await request(app).get(`/api/invoices/${invoice.id}`).set(auth());
      expect(invoiceDetail.tags.map((t: any) => t.id)).toEqual([target.id]);
      expect(new Date(invoiceDetail.updatedAt).getTime()).toBeGreaterThan(new Date(invoice.updatedAt).getTime());
      const { body: contractDetail } = await request(app).get(`/api/contracts/${contract.id}`).set(auth());
      expect(contractDetail.tags.map((t: any) => t.id)).toEqual([target.id]);
      expect(new Date(contractDetail.updatedAt).getTime()).toBeGreaterThan(new Date(contract.updatedAt).getTime());

      const { status: sourceStatus } = await request(app).get(`/api/tags/${source.id}`).set(auth());
      expect(sourceStatus).toEqual(404);
    });

    it('should not duplicate the target on records that already had both tags', async () => {
      const name = uniqueName('Saidas Diversas');
      const target = await insertTag(name);
      const source1 = await insertTag(name);
      const source2 = await insertTag(name);

      const { body: tx } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send(buildTransaction({ tags: [tagRef(target), tagRef(source1), tagRef(source2)] }));

      const { status } = await request(app)
        .post('/api/tags/merge')
        .set(auth())
        .send({ targetId: target.id, sourceIds: [source1.id, source2.id] });
      expect(status).toEqual(200);

      const { body: txDetail } = await request(app).get(`/api/transactions/${tx.id}`).set(auth());
      expect(txDetail.tags.map((t: any) => t.id)).toEqual([target.id]);
    });

    it('should also move the tags of previous transaction versions', async () => {
      const name = uniqueName('Diversos');
      const target = await insertTag(name);
      const source = await insertTag(name);

      const { body: v1 } = await request(app)
        .post('/api/transactions')
        .set(auth())
        .send(buildTransaction({ tags: [tagRef(source)] }));
      await request(app)
        .put(`/api/transactions/${v1.id}`)
        .set(auth())
        .send(buildTransaction({ description: 'v2', tags: [tagRef(source)] }));

      await request(app).post('/api/tags/merge').set(auth()).send({ targetId: target.id, sourceIds: [source.id] });

      const { body: history } = await request(app).get(`/api/transactions/${v1.id}/history`).set(auth());
      expect(history.data).toHaveLength(2);
      for (const version of history.data) {
        expect(version.tags.map((t: any) => t.id)).toEqual([target.id]);
      }
    });

    it('should no longer report the group after merging', async () => {
      const name = uniqueName('Impostos');
      const target = await insertTag(name);
      const source = await insertTag(name);

      await request(app).post('/api/tags/merge').set(auth()).send({ targetId: target.id, sourceIds: [source.id] });

      const { body } = await request(app).get('/api/tags/duplicates').set(auth());
      expect(body.every((g: any) => g.tags.every((t: any) => t.id !== target.id))).toBe(true);
    });

    it('should return 400 when the target is also a source', async () => {
      const tag = await insertTag(uniqueName('Loop'));
      const { status } = await request(app)
        .post('/api/tags/merge')
        .set(auth())
        .send({ targetId: tag.id, sourceIds: [tag.id] });
      expect(status).toEqual(400);
    });

    it('should return 400 without source ids', async () => {
      const tag = await insertTag(uniqueName('Empty'));
      const { status } = await request(app).post('/api/tags/merge').set(auth()).send({ targetId: tag.id, sourceIds: [] });
      expect(status).toEqual(400);
    });

    it('should return 404 when a source tag does not exist', async () => {
      const tag = await insertTag(uniqueName('Missing'));
      const { status } = await request(app)
        .post('/api/tags/merge')
        .set(auth())
        .send({ targetId: tag.id, sourceIds: [faker.string.uuid()] });
      expect(status).toEqual(404);
    });

    it("should return 404 when merging another user's tag", async () => {
      const user2Session = await createUserSession(adminToken);
      const foreign = await insertTag(uniqueName('Foreign'), user2Session.user.id);
      const mine = await insertTag(uniqueName('Mine'));

      const { status } = await request(app)
        .post('/api/tags/merge')
        .set(auth())
        .send({ targetId: mine.id, sourceIds: [foreign.id] });
      expect(status).toEqual(404);

      const foreignTag = await dataSource.getRepository(Tag).findOneBy({ id: foreign.id });
      expect(foreignTag).not.toBeNull();
    });
  });
});
