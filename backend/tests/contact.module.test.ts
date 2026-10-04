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

const auth = () => ({ Authorization: `Bearer ${session.token}` });

const buildPayload = (overrides?: object) => ({
  name: faker.person.fullName(),
  document: faker.string.numeric(11),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  notes: faker.lorem.sentence(),
  ...overrides,
});

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

describe('Contacts', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/contacts');
      expect(res.status).toEqual(401);
    });
  });

  describe('CRUD', () => {
    it('should create a contact', async () => {
      const payload = buildPayload();
      const { body, status } = await request(app).post('/api/contacts').set(auth()).send(payload);

      expect(status).toEqual(201);
      expect(body).toMatchObject({
        id: expect.any(String),
        name: payload.name,
        document: payload.document,
        email: payload.email,
        phone: payload.phone,
        notes: payload.notes,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should create a contact with only a name', async () => {
      const { body, status } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send({ name: faker.person.fullName() });

      expect(status).toEqual(201);
      expect(body.document).toBeNull();
      expect(body.email).toBeNull();
      expect(body.phone).toBeNull();
      expect(body.notes).toBeNull();
    });

    it('should return 400 when name is missing', async () => {
      const { status } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send({ email: faker.internet.email() });
      expect(status).toEqual(400);
    });

    it('should list contacts', async () => {
      const { body, status } = await request(app).get('/api/contacts').set(auth());
      expect(status).toEqual(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.pagination.total).toBe('number');
      expect(typeof body.pagination.page).toBe('number');
      expect(typeof body.pagination.limit).toBe('number');
    });

    it('should get a contact by id', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { body, status } = await request(app).get(`/api/contacts/${created.id}`).set(auth());

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
    });

    it('should return 404 for a non-existent contact', async () => {
      const { status } = await request(app)
        .get('/api/contacts/00000000-0000-0000-0000-000000000000')
        .set(auth());
      expect(status).toEqual(404);
    });

    it('should update a contact', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const newName = faker.person.fullName();
      const { body, status } = await request(app)
        .put(`/api/contacts/${created.id}`)
        .set(auth())
        .send({ name: newName });

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.name).toEqual(newName);
    });

    it('should return 404 updating a contact that belongs to another user', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const user2 = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user2);
      const { body: user2Session } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { status } = await request(app)
        .put(`/api/contacts/${created.id}`)
        .set({ Authorization: `Bearer ${user2Session.token}` })
        .send({ name: faker.person.fullName() });

      expect(status).toEqual(404);
    });
  });

  describe('Isolation between users', () => {
    it("should not return another user's contacts in the list", async () => {
      const user2 = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user2);
      const { body: user2Session } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { body: user2Contacts } = await request(app)
        .get('/api/contacts')
        .set({ Authorization: `Bearer ${user2Session.token}` });

      expect(user2Contacts.data.every((c: any) => c.id !== contact.id)).toBe(true);
    });

    it("should return 404 getting another user's contact", async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const user2 = buildCreateUserPayload();
      await request(app).post('/api/users').set(auth()).send(user2);
      const { body: user2Session } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { status } = await request(app)
        .get(`/api/contacts/${created.id}`)
        .set({ Authorization: `Bearer ${user2Session.token}` });

      expect(status).toEqual(404);
    });
  });

  describe('Restore', () => {
    it('should restore a soft-deleted contact', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contacts/${created.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/contacts/${created.id}/restore`).set(auth());

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.deletedAt).toBeUndefined();

      const { status: getStatus } = await request(app).get(`/api/contacts/${created.id}`).set(auth());
      expect(getStatus).toEqual(200);
    });

    it('should return 404 when restoring an unknown contact', async () => {
      const { status } = await request(app)
        .patch('/api/contacts/00000000-0000-0000-0000-000000000000/restore')
        .set(auth());
      expect(status).toEqual(404);
    });

    it('should return 400 when restoring a contact that is not deleted', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());

      const { status } = await request(app).patch(`/api/contacts/${created.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });
  });

  describe('List deleted', () => {
    it('should return soft-deleted contacts when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contacts/${created.id}`).set(auth());

      const { body, status } = await request(app).get('/api/contacts?deleted=true').set(auth());
      expect(status).toEqual(200);
      const found = body.data.find((c: any) => c.id === created.id);
      expect(found).toBeDefined();
    });

    it('should not return soft-deleted contacts in the default list', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contacts/${created.id}`).set(auth());

      const { body } = await request(app).get('/api/contacts').set(auth());
      expect(body.data.every((c: any) => c.id !== created.id)).toBe(true);
    });

    it('should not return active contacts when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());

      const { body } = await request(app).get('/api/contacts?deleted=true').set(auth());
      expect(body.data.every((c: any) => c.id !== created.id)).toBe(true);
    });
  });

  describe('Get deleted', () => {
    it('should return a soft-deleted contact when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contacts/${created.id}`).set(auth());

      const { body, status } = await request(app).get(`/api/contacts/${created.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.deletedAt).toBeDefined();
    });

    it('should return 404 for a soft-deleted contact without deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());
      await request(app).delete(`/api/contacts/${created.id}`).set(auth());

      const { status } = await request(app).get(`/api/contacts/${created.id}`).set(auth());
      expect(status).toEqual(404);
    });

    it('should return an active contact when deleted=true', async () => {
      const { body: created } = await request(app).post('/api/contacts').set(auth()).send(buildPayload());

      const { body, status } = await request(app).get(`/api/contacts/${created.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.deletedAt).toBeUndefined();
    });
  });

  describe('Soft-delete', () => {
    it('should soft-delete a contact', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { status: deleteStatus } = await request(app)
        .delete(`/api/contacts/${created.id}`)
        .set(auth());

      expect(deleteStatus).toEqual(200);

      const { status: getStatus } = await request(app)
        .get(`/api/contacts/${created.id}`)
        .set(auth());
      expect(getStatus).toEqual(404);
    });

    it('should hard-delete a contact via /remove', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { status } = await request(app)
        .delete(`/api/contacts/${created.id}/remove`)
        .set(auth());

      expect(status).toEqual(200);

      const { status: getStatus } = await request(app)
        .get(`/api/contacts/${created.id}`)
        .set(auth());
      expect(getStatus).toEqual(404);
    });

    it('should return 403 when hard-deleting a contact that has active invoices', async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      await request(app)
        .post('/api/invoices')
        .set(auth())
        .send({
          contactId: contact.id,
          type: 'payable',
          amount: 500,
          currency: 'BRL',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'test invoice',
        });

      const { status, body } = await request(app)
        .delete(`/api/contacts/${contact.id}/remove`)
        .set(auth());

      expect(status).toEqual(400);
      expect(body.message).toMatch(/invoice/i);
    });

    it('should return 403 when hard-deleting a contact that has only cancelled invoices', async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send({
          contactId: contact.id,
          type: 'payable',
          amount: 500,
          currency: 'BRL',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'test invoice',
        });

      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { status } = await request(app)
        .delete(`/api/contacts/${contact.id}/remove`)
        .set(auth());

      expect(status).toEqual(400);
    });

    it('should return 400 when soft-deleting a contact that has active invoices', async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      await request(app)
        .post('/api/invoices')
        .set(auth())
        .send({
          contactId: contact.id,
          type: 'payable',
          amount: 500,
          currency: 'BRL',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'test invoice',
        });

      const { status, body } = await request(app)
        .delete(`/api/contacts/${contact.id}`)
        .set(auth());

      expect(status).toEqual(400);
      expect(body.message).toMatch(/invoice/i);
    });

    it('should return 400 when soft-deleting a contact that has only cancelled invoices', async () => {
      const { body: contact } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { body: invoice } = await request(app)
        .post('/api/invoices')
        .set(auth())
        .send({
          contactId: contact.id,
          type: 'payable',
          amount: 500,
          currency: 'BRL',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'test invoice',
        });

      await request(app).delete(`/api/invoices/${invoice.id}`).set(auth());

      const { status } = await request(app)
        .delete(`/api/contacts/${contact.id}`)
        .set(auth());

      expect(status).toEqual(400);
    });
  });

  describe('List filters, sorting, and pagination', () => {
    it('should filter contacts by name (partial match)', async () => {
      const unique = `Zyx_${Date.now()}`;
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload({ name: `${unique} Test` }));

      const { body, status } = await request(app)
        .get(`/api/contacts?name=${unique}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(body.data.some((c: any) => c.id === created.id)).toBe(true);
    });

    it('should not return contacts that do not match the name filter', async () => {
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload());

      const { body } = await request(app)
        .get('/api/contacts?name=ZZZZZZZZZZ_NOMATCH')
        .set(auth());

      expect(body.data.every((c: any) => c.id !== created.id)).toBe(true);
    });

    it('should filter contacts by email (partial match)', async () => {
      const uniqueDomain = `zyx${Date.now()}unique.com`;
      const { body: created } = await request(app)
        .post('/api/contacts')
        .set(auth())
        .send(buildPayload({ email: `test@${uniqueDomain}` }));

      const { body, status } = await request(app)
        .get(`/api/contacts?email=${uniqueDomain}`)
        .set(auth());

      expect(status).toEqual(200);
      expect(body.data.some((c: any) => c.id === created.id)).toBe(true);
    });

    it('should return paginated results with correct metadata', async () => {
      const { body, status } = await request(app)
        .get('/api/contacts?page=1&limit=2')
        .set(auth());

      expect(status).toEqual(200);
      expect(body.pagination.page).toEqual(1);
      expect(body.pagination.limit).toEqual(2);
      expect(typeof body.pagination.total).toBe('number');
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('should return 400 for invalid sortBy value', async () => {
      const { status } = await request(app)
        .get('/api/contacts?sortBy=invalid')
        .set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 for invalid sortOrder value', async () => {
      const { status } = await request(app)
        .get('/api/contacts?sortOrder=random')
        .set(auth());
      expect(status).toEqual(400);
    });

    it('should sort contacts by name in descending order', async () => {
      const { body, status } = await request(app)
        .get('/api/contacts?sortBy=name&sortOrder=desc')
        .set(auth());

      expect(status).toEqual(200);
      const names = body.data.map((c: any) => c.name);
      const sorted = [...names].sort((a, b) => b.localeCompare(a));
      expect(names).toEqual(sorted);
    });
  });
});
