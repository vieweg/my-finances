import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, r } from '../helpers';

const SetupBody = s(
  Joi.object({
    name: Joi.string().required(),
    username: Joi.string().trim().required(),
    email: Joi.string().email().trim().required(),
    password: Joi.string().min(6).trim().required(),
    confirmPassword: Joi.string().required().description('Must match password'),
  }),
);

const SetupStatus = s(Joi.object({ needsSetup: Joi.boolean().required() }));

export const setupPaths = {
  '/api/setup': {
    get: {
      tags: ['Setup'],
      summary: 'Get setup status',
      description: '`needsSetup` is true while no account exists, i.e. before the first account is created.',
      responses: {
        200: jsonResponse(SetupStatus, 'Setup status'),
      },
    },
    post: {
      tags: ['Setup'],
      summary: 'Create the first account',
      description: 'Only allowed while no account exists. Log in afterwards with the new credentials.',
      requestBody: jsonBody(SetupBody),
      responses: {
        201: jsonResponse(ref('User'), 'Account created'),
        400: r[400],
        409: jsonResponse(ref('Error'), 'Setup has already been completed'),
      },
    },
  },
};
