import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r } from '../helpers';

const CreateUserBody = s(
  Joi.object({
    name: Joi.string().required(),
    username: Joi.string().trim().required(),
    email: Joi.string().email().trim().required(),
    password: Joi.string().min(6).trim().required(),
    confirmPassword: Joi.string().required().description('Must match password'),
  }),
);

const UpdateUserBody = s(
  Joi.object({
    name: Joi.string().trim().optional(),
    username: Joi.string().trim().optional(),
    password: Joi.string().min(6).trim().optional().description('Current password — required when changing password'),
    newPassword: Joi.string().min(6).optional(),
    confirmPassword: Joi.string().optional().description('Must match newPassword'),
  }),
);

const ForgotPasswordBody = s(Joi.object({ email: Joi.string().email().trim().required() }));

const ChangePasswordBody = s(
  Joi.object({
    token: Joi.string().required().description('JWT reset token received by email'),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().required().description('Must match password'),
  }),
);

export const usersPaths = {
  '/api/users': {
    get: {
      tags: ['Users'],
      summary: 'List users',
      security,
      responses: {
        200: jsonResponse({ type: 'array', items: ref('User') }),
        401: r[401],
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Create user',
      security,
      requestBody: jsonBody(CreateUserBody),
      responses: {
        201: jsonResponse(ref('User')),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/users/forgot': {
    post: {
      tags: ['Users'],
      summary: 'Request password reset email',
      description:
        'Sends a password reset link to the provided email. Always returns 204 regardless of whether the email exists (prevents enumeration).',
      requestBody: jsonBody(ForgotPasswordBody),
      responses: {
        204: r[204],
        400: r[400],
      },
    },
  },
  '/api/users/password': {
    patch: {
      tags: ['Users'],
      summary: 'Reset password using token',
      description: 'Consumes the JWT token from the password reset email to set a new password.',
      requestBody: jsonBody(ChangePasswordBody),
      responses: {
        200: jsonResponse(ref('User')),
        400: r[400],
      },
    },
  },
  '/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get user by id',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('User')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Users'],
      summary: 'Update user',
      description:
        'Supports partial updates. To change the password provide `password` (current), `newPassword`, and `confirmPassword`.',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(UpdateUserBody),
      responses: {
        200: jsonResponse(ref('User')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Soft-delete user',
      security,
      parameters: [idParam()],
      responses: {
        204: r[204],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/users/{id}/remove': {
    delete: {
      tags: ['Users'],
      summary: 'Hard-delete user',
      description: 'Permanently removes the user and all related data. Irreversible.',
      security,
      parameters: [idParam()],
      responses: {
        204: r[204],
        401: r[401],
        404: r[404],
      },
    },
  },
};
