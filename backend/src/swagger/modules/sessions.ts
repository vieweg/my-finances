import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, r } from '../helpers';

const LoginBody = s(
  Joi.object({
    username: Joi.string().trim().required().description('Username or email address'),
    password: Joi.string().trim().max(128).required(),
  }),
);

export const sessionsPaths = {
  '/api/sessions': {
    post: {
      tags: ['Sessions'],
      summary: 'Login',
      description:
        'Authenticate with username or email and password. Returns a short-lived access token (default 15m) and sets a long-lived `refresh_token` httpOnly cookie (default 7d).',
      requestBody: jsonBody(LoginBody),
      responses: {
        201: jsonResponse(ref('Session'), 'Login successful'),
        400: r[400],
        401: r[401],
      },
    },
    delete: {
      tags: ['Sessions'],
      summary: 'Logout current session',
      security,
      responses: {
        200: { description: 'Session deleted' },
        401: r[401],
      },
    },
  },
  '/api/sessions/refresh': {
    post: {
      tags: ['Sessions'],
      summary: 'Refresh access token',
      description:
        'Exchange the `refresh_token` httpOnly cookie for a new access token. A rotated `refresh_token` cookie is set in the response.',
      parameters: [
        {
          in: 'cookie',
          name: 'refresh_token',
          required: true,
          schema: { type: 'string' },
          description: 'Long-lived refresh token set on login',
        },
      ],
      responses: {
        200: jsonResponse(ref('Session'), 'New access token issued'),
        401: r[401],
      },
    },
  },
  '/api/sessions/all': {
    delete: {
      tags: ['Sessions'],
      summary: 'Logout all sessions',
      description: 'Invalidates every active session for the authenticated user across all devices.',
      security,
      responses: {
        200: { description: 'All sessions deleted' },
        401: r[401],
      },
    },
  },
};
