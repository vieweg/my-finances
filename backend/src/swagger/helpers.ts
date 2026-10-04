import j2s from 'joi-to-swagger';
import Joi from 'joi';
import { VALID_CURRENCIES } from '../constants';
export const s = (schema: Joi.Schema) => j2s(schema).swagger;

export const jsonBody = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});

export const jsonResponse = (schema: object, description = 'Success') => ({
  description,
  content: { 'application/json': { schema } },
});

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Response of a paginated list: { data: [...items], pagination }
export const paginated = (items: object) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items },
    pagination: ref('Pagination'),
  },
});

export const security = [{ bearerAuth: [] }];

export const idParam = (name = 'id', description = 'Resource UUID') => ({
  name,
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description,
});

export const includeDeletedParam = {
  name: 'deleted',
  in: 'query' as const,
  required: false,
  schema: { type: 'boolean' },
  description: 'When true, also return the entry if it is soft-deleted (response then includes `deletedAt`)',
};

export const currencyHeader = {
  name: 'x-currency',
  in: 'header' as const,
  required: false,
  schema: { type: 'string', enum: [...VALID_CURRENCIES] },
  description:
    'Session-level currency context. When set on list endpoints, only records matching this currency are returned and `filterByCurrency` is disallowed. When set on create/update endpoints, the header currency is used and `currency` in the body is disallowed.',
};

export const r = {
  400: jsonResponse(ref('ValidationError'), 'Validation error'),
  401: jsonResponse(ref('Error'), 'Unauthorized'),
  403: jsonResponse(ref('Error'), 'Forbidden'),
  404: jsonResponse(ref('Error'), 'Not found'),
  204: { description: 'No content' },
};
