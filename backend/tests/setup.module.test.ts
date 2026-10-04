import { describe, expect, it, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { dataSource } from '../src/database';
import { User } from '../src/modules/users/models/user.model';
import { buildCreateUserPayload } from './global/setupTests';

// The test database always has the seeded admin, so an empty database is simulated
// by making the user count return 0
const simulateNoUsers = () =>
  jest.spyOn(dataSource.getRepository(User), 'count').mockResolvedValueOnce(0);

describe('Setup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/setup', () => {
    it('should not need setup once an account exists', async () => {
      const response = await request(app).get('/api/setup');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ needsSetup: false });
    });

    it('should need setup while no account exists', async () => {
      simulateNoUsers();
      const response = await request(app).get('/api/setup');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ needsSetup: true });
    });
  });

  describe('POST /api/setup', () => {
    it('should refuse to create an account once one exists', async () => {
      const response = await request(app).post('/api/setup').send(buildCreateUserPayload());

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Setup has already been completed');
    });

    it('should validate the payload', async () => {
      const response = await request(app)
        .post('/api/setup')
        .send(buildCreateUserPayload({ password: 'abc12345', confirmPassword: 'different' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Confirm password must match the password');
    });

    it('should create the first account, which can then log in', async () => {
      simulateNoUsers();
      const payload = buildCreateUserPayload();
      const response = await request(app).post('/api/setup').send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ username: payload.username, email: payload.email });
      expect(response.body).not.toHaveProperty('password');

      const login = await request(app)
        .post('/api/sessions')
        .send({ username: payload.username, password: payload.password });
      expect(login.status).toBe(201);
    });
  });
});
