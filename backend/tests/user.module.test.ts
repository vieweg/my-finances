import { describe, expect, it, beforeAll, jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker/locale/en';
import { v4 as uuidv4 } from 'uuid';
import { AxiosResponse } from 'axios';
import {
  adminUserCredentials,
  SessionResponseDto,
  buildCreateUserPayload,
} from './global/setupTests';
import EmailService from '../src/email/service';
import { dataSource } from '../src/database';
import app from '../src/app';
import {
  UpdateUserService,
  CreateUserService,
  ForgotPasswordService,
} from '../src/modules/users/services';

let session: SessionResponseDto;

const renderTemplateMocked = jest.spyOn(EmailService.prototype, 'renderTemplate');
const sendEmailMocked = jest.spyOn(EmailService.prototype, 'sendEmail').mockImplementation(
  jest.fn(
    async (
      _to: { email: string; name: string },
      _subject: string,
      _htmlContent: string,
    ): Promise<AxiosResponse> => {
      return {} as AxiosResponse;
    },
  ),
);

beforeAll(async () => {
  const { username, password } = adminUserCredentials;
  const { body } = await request(app).post('/api/sessions').send({ username, password });
  session = body;
});

describe('Users', () => {
  describe('Routes', () => {
    it('should return 401 trying to create a user without authentication', async () => {
      const payload = buildCreateUserPayload();
      const response = await request(app).post('/api/users').send(payload);

      expect(response.status).toEqual(401);
      expect(response.body).toMatchObject({ message: 'Unauthorized: No token provided' });
    });

    it('should create and return the new user without sensitive data', async () => {
      const payload = buildCreateUserPayload();
      const response = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      const { password, confirmPassword, ...expectedResponse } = payload;

      expect(response.status).toEqual(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        updatedAt: expect.any(String),
        createdAt: expect.any(String),
        ...expectedResponse,
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('resetToken');
    });

    it('should return an error creating user with an existing email or username', async () => {
      const response = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send({
          ...adminUserCredentials,
          name: faker.person.fullName(),
          confirmPassword: adminUserCredentials.password,
        });

      expect(response.status).toEqual(400);
      expect(response.body).toMatchObject({
        message: 'Username or email provided was already taken',
      });
    });

    it('should return an array of users without sensitive data', async () => {
      const response = await request(app)
        .get('/api/users')
        .set({ Authorization: `Bearer ${session.token}` });

      expect(response.status).toEqual(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        updatedAt: expect.any(String),
        createdAt: expect.any(String),
        name: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
      });
      expect(response.body[0]).not.toHaveProperty('password');
      expect(response.body[0]).not.toHaveProperty('resetToken');
    });

    it('should return a user by id without sensitive data', async () => {
      const response = await request(app)
        .get(`/api/users/${session.user.id}`)
        .set({ Authorization: `Bearer ${session.token}` });

      expect(response.status).toEqual(200);
      expect(response.body).toMatchObject(session.user);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should update a user via PUT /users/:id', async () => {
      const payload = buildCreateUserPayload();
      const newName = faker.person.fullName();

      const createdUser = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      const { password, confirmPassword, email, ...fields } = payload;

      const updatedUser = await request(app)
        .put(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` })
        .send({ ...fields, name: newName });

      expect(updatedUser.status).toEqual(200);
      expect(updatedUser.body).toMatchObject({
        id: createdUser.body.id,
        ...fields,
        name: newName,
      });
    });

    it('should return 400 updating user with a taken username', async () => {
      const payload = buildCreateUserPayload();

      const createdUser = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      const { password, confirmPassword, email, ...fields } = payload;

      const sameUsername = await request(app)
        .put(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` })
        .send({ ...fields, username: adminUserCredentials.username });

      expect(sameUsername.status).toEqual(400);
      expect(sameUsername.body).toMatchObject({
        message: 'Username or email provided was already taken',
      });
    });

    it('should return 400/401 updating password with invalid parameters', async () => {
      const payload = buildCreateUserPayload();
      const newPassword = faker.internet.password();

      const createdUser = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      const { password, confirmPassword, email, ...fields } = payload;

      const noConfirm = await request(app)
        .put(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` })
        .send({ ...fields, password, newPassword });

      const diffPasswords = await request(app)
        .put(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` })
        .send({ ...fields, password, newPassword, confirmPassword: 'wrong' });

      const wrongOld = await request(app)
        .put(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` })
        .send({ ...fields, password: 'wrongpassword', newPassword, confirmPassword: newPassword });

      expect(noConfirm.status).toEqual(400);
      expect(diffPasswords.status).toEqual(400);
      expect(diffPasswords.body.error).toContain('Confirm password must match the password');
      expect(wrongOld.status).toEqual(401);
      expect(wrongOld.body).toMatchObject({ message: 'Current password is incorrect' });
    });

    it('should soft-delete a user and return 404 on subsequent get', async () => {
      const payload = buildCreateUserPayload();

      const createdUser = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      const deleteRes = await request(app)
        .delete(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` });

      const getRes = await request(app)
        .get(`/api/users/${createdUser.body.id}`)
        .set({ Authorization: `Bearer ${session.token}` });

      expect(deleteRes.status).toBe(204);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 trying to delete a non-existent user', async () => {
      const response = await request(app)
        .delete(`/api/users/${uuidv4()}`)
        .set({ Authorization: `Bearer ${session.token}` });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ message: 'User not found or already deleted' });
    });

    it('should reset user password using the token sent by email', async () => {
      const payload = buildCreateUserPayload();
      const newPassword = faker.internet.password();

      const createdUser = await request(app)
        .post('/api/users')
        .set({ Authorization: `Bearer ${session.token}` })
        .send(payload);

      await request(app).post('/api/users/forgot').send({ email: createdUser.body.email });

      const html: any =
        renderTemplateMocked.mock.results[renderTemplateMocked.mock.results.length - 1].value;
      const match = html.match(
        /<a[^>]*id=["']reset-link["'][^>]*href=["'][^"']*token=([^"&']+)["']/i,
      );
      const resetToken = match ? match[1] : null;

      await request(app).patch('/api/users/password').send({
        token: resetToken,
        password: newPassword,
        confirmPassword: newPassword,
      });

      const login = await request(app).post('/api/sessions').send({
        username: createdUser.body.username,
        password: newPassword,
      });

      expect(login.status).toBe(201);
      expect(login.body).toHaveProperty('token');
      expect(login.body).not.toHaveProperty('refreshToken');
      expect(login.body).toHaveProperty('user');
    });
  });

  describe('Services', () => {
    it('should hash the password on create and on update', async () => {
      const payload = buildCreateUserPayload();
      const newPassword = faker.internet.password();
      const createService = new CreateUserService();
      const updateService = new UpdateUserService();

      const createdUser = await createService.execute(payload);
      const foundCreated = await dataSource.getRepository('User').findOneBy({ id: createdUser.id });

      const updatedUser = await updateService.execute({
        id: createdUser.id,
        ...payload,
        password: payload.password,
        newPassword,
        confirmPassword: newPassword,
      });

      const foundUpdated = await dataSource.getRepository('User').findOneBy({ id: updatedUser.id });
      const isValid = await bcrypt.compare(newPassword, foundUpdated?.password || '');

      expect(foundCreated?.password).not.toBe(payload.password);
      expect(foundUpdated?.password).not.toBe(newPassword);
      expect(isValid).toBeTruthy();
    });

    it('should send a reset password email with a token link', async () => {
      const payload = buildCreateUserPayload();
      const createService = new CreateUserService();
      const createdUser = await createService.execute(payload);

      const forgotService = new ForgotPasswordService();
      await forgotService.execute(createdUser.email);

      const html: any =
        renderTemplateMocked.mock.results[renderTemplateMocked.mock.results.length - 1].value;
      const match = html.match(
        /<a[^>]*id=["']reset-link["'][^>]*href=["'][^"']*token=([^"&']+)["']/i,
      );

      expect(sendEmailMocked).toHaveBeenCalledWith(
        { email: createdUser.email, name: createdUser.name },
        'Password Reset Request',
        expect.any(String),
      );
      expect(match).not.toBeNull();
    });
  });
});
