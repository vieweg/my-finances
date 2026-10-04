import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { faker } from '@faker-js/faker/locale/en';
import {
  adminUserCredentials,
  SessionResponseDto,
  buildCreateUserPayload,
} from './global/setupTests';
import { dataSource } from '../src/database';
import { Tag } from '../src/modules/tags/models/tags.model';
import app from '../src/app';

let session: SessionResponseDto;

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

describe('Tags', () => {
  describe('Auth guard', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toEqual(401);
    });
  });

  describe('CRUD', () => {
    it('should create a tag', async () => {
      const name = faker.word.noun();
      const { body, status } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      expect(status).toEqual(200);
      expect(body).toMatchObject({
        id: expect.any(String),
        name,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 400 creating a tag with a duplicate name for the same user', async () => {
      const name = faker.word.noun();

      await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const { status, body } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      expect(status).toEqual(400);
      expect(body.message).toEqual('Tag already exists');
    });

    it('should allow the same tag name for different users', async () => {
      const name = faker.word.noun();

      const user2 = buildCreateUserPayload();
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${session.token}`)
        .send(user2);
      const { body: user2Session } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const res1 = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const res2 = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${user2Session.token}`)
        .send({ name });

      expect(res1.status).toEqual(200);
      expect(res2.status).toEqual(200);
      expect(res1.body.id).not.toEqual(res2.body.id);
    });

    it('should get a tag by id', async () => {
      const name = faker.word.noun();
      const { body: created } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const { body, status } = await request(app)
        .get(`/api/tags/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.name).toEqual(name);
    });

    it('should return 404 getting a tag that belongs to another user', async () => {
      const name = faker.word.noun();
      const { body: created } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const user2 = buildCreateUserPayload();
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${session.token}`)
        .send(user2);
      const { body: user2Session } = await request(app)
        .post('/api/sessions')
        .send({ username: user2.username, password: user2.password });

      const { status } = await request(app)
        .get(`/api/tags/${created.id}`)
        .set('Authorization', `Bearer ${user2Session.token}`);

      expect(status).toEqual(404);
    });

    it('should update a tag name via PUT /tags/:id', async () => {
      const name = faker.word.noun();
      const newName = faker.word.noun();

      const { body: created } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const { body, status } = await request(app)
        .put(`/api/tags/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name: newName });

      expect(status).toEqual(200);
      expect(body.id).toEqual(created.id);
      expect(body.name).toEqual(newName);
    });

    it('should list tags', async () => {
      const { body, status } = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${session.token}`);

      expect(status).toEqual(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.pagination.total).toBe('number');
      expect(typeof body.pagination.page).toBe('number');
      expect(typeof body.pagination.limit).toBe('number');
    });
  });

  describe('Search', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });
    const createTag = (name: string) => request(app).post('/api/tags').set(auth()).send({ name });

    beforeAll(async () => {
      await Promise.all([
        createTag('searchable-alpha'),
        createTag('searchable-beta'),
        createTag('unrelated-gamma'),
      ]);
    });

    it('should return only matching tags for a search term', async () => {
      const { body, status } = await request(app).get('/api/tags?search=searchable').set(auth());

      expect(status).toEqual(200);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data.every((t: any) => t.name.includes('searchable'))).toBe(true);
    });

    it('should return an empty array when no tags match', async () => {
      const { body, status } = await request(app).get('/api/tags?search=zzznomatch').set(auth());

      expect(status).toEqual(200);
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toEqual(0);
    });

    it('should do a partial match (substring)', async () => {
      const { body } = await request(app).get('/api/tags?search=alpha').set(auth());

      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.some((t: any) => t.name === 'searchable-alpha')).toBe(true);
      expect(body.data.every((t: any) => t.name.includes('alpha'))).toBe(true);
    });
  });

  describe('List sorting and pagination', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });

    it('should return paginated results with correct metadata', async () => {
      const { body, status } = await request(app).get('/api/tags?page=1&limit=2').set(auth());

      expect(status).toEqual(200);
      expect(body.pagination.page).toEqual(1);
      expect(body.pagination.limit).toEqual(2);
      expect(typeof body.pagination.total).toBe('number');
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('should sort tags by name in descending order', async () => {
      const { body, status } = await request(app).get('/api/tags?sortBy=name&sortOrder=desc').set(auth());

      expect(status).toEqual(200);
      const names = body.data.map((t: any) => t.name);
      const sorted = [...names].sort((a, b) => b.localeCompare(a));
      expect(names).toEqual(sorted);
    });

    it('should return 400 for invalid sortBy value', async () => {
      const { status } = await request(app).get('/api/tags?sortBy=invalid').set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 for invalid sortOrder value', async () => {
      const { status } = await request(app).get('/api/tags?sortOrder=random').set(auth());
      expect(status).toEqual(400);
    });
  });

  describe('Soft-delete', () => {
    it('should soft-delete a tag and remove it from the list', async () => {
      const name = faker.word.noun();
      const { body: created } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      const { status: deleteStatus } = await request(app)
        .delete(`/api/tags/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(deleteStatus).toEqual(200);

      const { status: getStatus } = await request(app)
        .get(`/api/tags/${created.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(getStatus).toEqual(404);
    });

    it('should restore a soft-deleted tag when re-created with the same name', async () => {
      const name = faker.word.noun();

      const { body: original } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      await request(app)
        .delete(`/api/tags/${original.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      const { body: restored, status } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name });

      expect(status).toEqual(200);
      expect(restored.id).toEqual(original.id); // same row was restored
      expect(restored.name).toEqual(name);
    });

    it('should preserve deleted tag data in transaction version history', async () => {
      const tagName = faker.word.noun();

      // Create a tag and a transaction that uses it
      const { body: tag } = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ name: tagName });

      const { body: transaction } = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 100,
          currency: 'BRL',
          description: 'test',
          type: 'income',
          tags: [{ id: tag.id, name: tag.name }],
        });

      // Update the transaction to create v2 (without the tag)
      await request(app)
        .put(`/api/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          date: new Date().toISOString(),
          total: 100,
          currency: 'BRL',
          description: 'updated',
          type: 'income',
          tags: [],
        });

      // Now soft-delete the tag
      await request(app)
        .delete(`/api/tags/${tag.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      // v1 in history should still show the tag
      const { body: detail } = await request(app)
        .get(`/api/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(detail.history).toHaveLength(1);
      expect(detail.history[0].tags).toHaveLength(1);
      expect(detail.history[0].tags[0].id).toEqual(tag.id);
    });
  });

  describe('Deleted tags', () => {
    const auth = () => ({ Authorization: `Bearer ${session.token}` });
    const createTag = () =>
      request(app)
        .post('/api/tags')
        .set(auth())
        .send({ name: `restorable ${faker.string.alphanumeric(10)}` })
        .then((r) => r.body);

    it('should list and get soft-deleted tags with deleted=true', async () => {
      const tag = await createTag();
      await request(app).delete(`/api/tags/${tag.id}`).set(auth());

      const { body: list } = await request(app).get('/api/tags?deleted=true&limit=100&sortBy=createdAt&sortOrder=desc').set(auth());
      expect(list.data.find((t: any) => t.id === tag.id)).toBeDefined();
      expect(list.data.every((t: any) => t.deletedAt)).toBe(true);

      const { status: hidden } = await request(app).get(`/api/tags/${tag.id}`).set(auth());
      expect(hidden).toEqual(404);
      const { body, status } = await request(app).get(`/api/tags/${tag.id}?deleted=true`).set(auth());
      expect(status).toEqual(200);
      expect(body.deletedAt).toBeDefined();
    });

    it('should restore a soft-deleted tag', async () => {
      const tag = await createTag();
      await request(app).delete(`/api/tags/${tag.id}`).set(auth());

      const { body, status } = await request(app).patch(`/api/tags/${tag.id}/restore`).set(auth());
      expect(status).toEqual(200);
      expect(body.id).toEqual(tag.id);
      expect(body.deletedAt).toBeUndefined();

      const { status: getStatus } = await request(app).get(`/api/tags/${tag.id}`).set(auth());
      expect(getStatus).toEqual(200);
    });

    it('should return 400 when an active tag already has the same name', async () => {
      const tag = await createTag();
      await request(app).delete(`/api/tags/${tag.id}`).set(auth());
      // POST /api/tags would restore the deleted tag, so the conflicting active tag is inserted directly
      await dataSource.getRepository(Tag).save({ name: tag.name.toUpperCase(), user: { id: session.user.id } });

      const { status } = await request(app).patch(`/api/tags/${tag.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 400 when restoring a tag that is not deleted', async () => {
      const tag = await createTag();
      const { status } = await request(app).patch(`/api/tags/${tag.id}/restore`).set(auth());
      expect(status).toEqual(400);
    });

    it('should return 404 when restoring an unknown tag', async () => {
      const { status } = await request(app).patch(`/api/tags/${faker.string.uuid()}/restore`).set(auth());
      expect(status).toEqual(404);
    });
  });
});
