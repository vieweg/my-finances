import { describe, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import ms from 'ms';
import { adminUserCredentials } from './global/setupTests';
import { sign, JwtPayload, verify, SignOptions } from 'jsonwebtoken';

const { username, password, email } = adminUserCredentials;

const {
  JWT_SECRET = '',
  JWT_EXPIRATION = '',
  JWT_SECRET_REFRESH = '',
  JWT_EXPIRATION_REFRESH = '',
} = process.env;

function isExpireAtValid(token: JwtPayload, expectExpiresIn: ms.StringValue) {
  const tokenExpiresAt = new Date((token.exp || 0) * 1000);
  const expiresInMs = ms(expectExpiresIn);
  const expectedExpiresAt = new Date(
    Date.now() + (typeof expiresInMs === 'number' ? expiresInMs : 0),
  );
  const diff = Math.abs(expectedExpiresAt.getTime() - tokenExpiresAt.getTime());
  return diff < 60_000;
}

function getRefreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((c) => c.startsWith('refresh_token=')) ?? '';
}

function getRefreshTokenValue(res: request.Response): string {
  return getRefreshCookie(res).split(';')[0].replace('refresh_token=', '');
}

describe('Sessions', () => {
  describe('Routes', () => {
    it('should return 401 if atempt to login with invalid credentials', async () => {
      const response = await request(app).post('/api/sessions').send({
        username,
        password: 'wrong_password',
      });

      expect(response.status).toEqual(401);
      expect(response.body).toMatchObject({
        message: 'User not found or wrong credetials',
      });
    });

    it('should login a user using Username or Email', async () => {
      const responseUsername = await request(app).post('/api/sessions').send({
        username,
        password,
      });
      const responseEmail = await request(app).post('/api/sessions').send({
        username: email,
        password,
      });

      expect(responseUsername.status).toEqual(201);
      expect(responseUsername.body).toHaveProperty('user');
      expect(responseUsername.body.user.username).toBe(username);
      expect(responseEmail.status).toEqual(201);
      expect(responseEmail.body).toHaveProperty('user');
      expect(responseEmail.body.user.username).toBe(username);
    });

    it('should login a user and return a valid token and set a refresh token httpOnly cookie', async () => {
      const response = await request(app).post('/api/sessions').send({ username, password });

      const token = verify(response.body.token, JWT_SECRET) as JwtPayload;
      const refreshTokenValue = getRefreshTokenValue(response);
      const refreshToken = verify(refreshTokenValue, JWT_SECRET_REFRESH) as JwtPayload;

      expect(response.status).toEqual(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.body.user).not.toHaveProperty('password');
      expect(getRefreshCookie(response)).toContain('HttpOnly');
      expect(isExpireAtValid(token, JWT_EXPIRATION as ms.StringValue)).toBeTruthy();
      expect(isExpireAtValid(refreshToken, JWT_EXPIRATION_REFRESH as ms.StringValue)).toBeTruthy();
    });

    it('should return a new token when using a valid refresh token cookie', async () => {
      const session = await request(app).post('/api/sessions').send({ username, password });

      const response = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session));

      const token = verify(response.body.token, JWT_SECRET) as JwtPayload;
      const refreshTokenValue = getRefreshTokenValue(response);
      const refreshToken = verify(refreshTokenValue, JWT_SECRET_REFRESH) as JwtPayload;

      expect(response.status).toEqual(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.body.user).not.toHaveProperty('password');
      expect(isExpireAtValid(token, JWT_EXPIRATION as ms.StringValue)).toBeTruthy();
      expect(isExpireAtValid(refreshToken, JWT_EXPIRATION_REFRESH as ms.StringValue)).toBeTruthy();
    });

    it('should return 401 when trying to use an expired access token', async () => {
      const jwtExp = JWT_EXPIRATION;
      process.env.JWT_EXPIRATION = '0';

      const session = await request(app).post('/api/sessions').send({ username, password });

      process.env.JWT_EXPIRATION = jwtExp;

      const response = await request(app)
        .delete('/api/sessions')
        .set({ Authorization: `Bearer ${session.body.token}` });

      expect(response.status).toEqual(401);
      expect(response.body).toMatchObject({ message: 'Unauthorized: Invalid token' });
    });

    it('should return 401 when trying to refresh using a token not stored in DB', async () => {
      const refreshToken = sign({ id: '' }, JWT_SECRET_REFRESH, {
        expiresIn: JWT_EXPIRATION_REFRESH,
      } as SignOptions);

      const response = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`);

      expect(response.status).toEqual(401);
      expect(response.body).toMatchObject({ message: 'Refresh token invalid or expired' });
    });

    it('should return 401 when trying to refresh using an expired refresh token', async () => {
      const jwtExp = JWT_EXPIRATION_REFRESH;
      process.env.JWT_EXPIRATION_REFRESH = '0';

      const session = await request(app).post('/api/sessions').send({ username, password });

      process.env.JWT_EXPIRATION_REFRESH = jwtExp;

      const response = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session));

      expect(response.status).toEqual(401);
      expect(response.body).toMatchObject({ message: 'Refresh token invalid or expired' });
    });

    it('should logout a user from current session', async () => {
      const session = await request(app).post('/api/sessions').send({ username, password });

      const response = await request(app)
        .delete('/api/sessions')
        .set({ Authorization: `Bearer ${session.body.token}` });

      const refresh = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session));

      expect(response.status).toEqual(200);
      expect(refresh.status).toEqual(401);
    });

    it('should logout a user from a specific session and also from all active sessions', async () => {
      const session1 = await request(app).post('/api/sessions').send({ username, password });
      const session2 = await request(app).post('/api/sessions').send({ username, password });
      const session3 = await request(app).post('/api/sessions').send({ username, password });

      // delete only session1
      await request(app)
        .delete('/api/sessions')
        .set({ Authorization: `Bearer ${session1.body.token}` });

      // session1 refresh cookie should be invalid
      const deletedSession1 = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session1));

      // session2 refresh cookie should still be valid; token is rotated in response
      const validSession2 = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session2));

      // delete remaining sessions using the new access token from the rotated session2
      await request(app)
        .delete('/api/sessions/all')
        .set({ Authorization: `Bearer ${validSession2.body.token}` });

      // original session2 cookie is now invalid (token was rotated above)
      const deletedSession2 = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session2));

      // session3 was deleted by destroyAll
      const deletedSession3 = await request(app)
        .post('/api/sessions/refresh')
        .set('Cookie', getRefreshCookie(session3));

      expect(validSession2.status).toEqual(200);
      expect(deletedSession1.status).toEqual(401);
      expect(deletedSession2.status).toEqual(401);
      expect(deletedSession3.status).toEqual(401);
    });
  });
});
