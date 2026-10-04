import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, includeDeletedParam } from '../helpers';

const CreateContactBody = s(
  Joi.object({
    name: Joi.string().trim().required(),
    document: Joi.string().trim().optional(),
    email: Joi.string().email().trim().optional(),
    phone: Joi.string().trim().optional(),
    notes: Joi.string().trim().optional(),
  }),
);

const UpdateContactBody = s(
  Joi.object({
    name: Joi.string().trim().optional(),
    document: Joi.string().trim().allow(null, '').optional(),
    email: Joi.string().email().trim().allow(null, '').optional(),
    phone: Joi.string().trim().allow(null, '').optional(),
    notes: Joi.string().trim().allow(null, '').optional(),
  }),
);

export const contactsPaths = {
  '/api/contacts': {
    get: {
      tags: ['Contacts'],
      summary: 'List contacts',
      security,
      parameters: [
        {
          name: 'deleted',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'When true, return only soft-deleted entries',
        },
        {
          name: 'name',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by name (partial match)',
        },
        {
          name: 'email',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by email (partial match)',
        },
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['name', 'email', 'createdAt', 'updatedAt'] },
          description: 'Field to sort by (default: name)',
        },
        {
          name: 'sortOrder',
          in: 'query',
          schema: { type: 'string', enum: ['asc', 'desc'] },
          description: 'Sort direction (default: asc)',
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          description: 'Items per page',
        },
      ],
      responses: {
        200: jsonResponse(ref('ContactList')),
        401: r[401],
      },
    },
    post: {
      tags: ['Contacts'],
      summary: 'Create contact',
      security,
      requestBody: jsonBody(CreateContactBody),
      responses: {
        201: jsonResponse(ref('Contact'), 'Created'),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/contacts/{id}': {
    get: {
      tags: ['Contacts'],
      summary: 'Get contact by id',
      security,
      parameters: [idParam(), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('Contact')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Contacts'],
      summary: 'Update contact',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(UpdateContactBody),
      responses: {
        200: jsonResponse(ref('Contact')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Contacts'],
      summary: 'Soft-delete contact',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Contact')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/contacts/{id}/remove': {
    delete: {
      tags: ['Contacts'],
      summary: 'Hard-delete contact',
      description: 'Permanently removes the contact. Returns 403 if the contact has any invoices (active or cancelled).',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Contact')),
        401: r[401],
        403: r[403],
        404: r[404],
      },
    },
  },
  '/api/contacts/{id}/restore': {
    patch: {
      tags: ['Contacts'],
      summary: 'Restore a soft-deleted contact',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Contact')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
