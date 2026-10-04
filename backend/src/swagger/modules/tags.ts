import Joi from 'joi';
import { s, jsonBody, jsonResponse, ref, security, idParam, r, includeDeletedParam } from '../helpers';
import { PAGINATION_TAGS } from '../../constants';

const CreateTagBody = s(Joi.object({ name: Joi.string().min(3).max(50).trim().required() }));

const MergeTagsBody = s(
  Joi.object({
    targetId: Joi.string().uuid().required().description('Tag that is kept'),
    sourceIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .max(50)
      .unique()
      .required()
      .description('Tags merged into the target and then soft-deleted'),
  }),
);

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: PAGINATION_TAGS.MAX_LIMIT, default: PAGINATION_TAGS.DEFAULT_LIMIT }, description: `Items per page (max: ${PAGINATION_TAGS.MAX_LIMIT})` },
];

const sortParams = [
  { name: 'sortBy', in: 'query', schema: { type: 'string', enum: PAGINATION_TAGS.SORT_BY }, description: 'Field to sort by' },
  { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: PAGINATION_TAGS.SORT_ORDER }, description: 'Sort direction' },
];

export const tagsPaths = {
  '/api/tags': {
    get: {
      tags: ['Tags'],
      summary: 'List tags',
      security,
      parameters: [
        ...paginationParams,
        ...sortParams,
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter tags by name (case-insensitive partial match)' },
        { name: 'deleted', in: 'query', schema: { type: 'boolean' }, description: 'When true, return only soft-deleted entries' },
      ],
      responses: {
        200: jsonResponse(ref('TagList')),
        401: r[401],
      },
    },
    post: {
      tags: ['Tags'],
      summary: 'Create tag',
      description: 'Tag names are unique per user. If a tag with the same name was previously deleted it will be restored.',
      security,
      requestBody: jsonBody(CreateTagBody),
      responses: {
        200: jsonResponse(ref('Tag')),
        400: r[400],
        401: r[401],
      },
    },
  },
  '/api/tags/duplicates': {
    get: {
      tags: ['Tags'],
      summary: 'List duplicated tags',
      description:
        'Groups active tags whose names only differ by accents, case or whitespace. Each tag includes how many active transactions, invoices and contracts use it. Within a group the most used tag comes first and is the suggested merge target.',
      security,
      responses: {
        200: jsonResponse({ type: 'array', items: ref('TagDuplicateGroup') }),
        401: r[401],
      },
    },
  },
  '/api/tags/merge': {
    post: {
      tags: ['Tags'],
      summary: 'Merge tags',
      description:
        'Moves every transaction (including previous versions), invoice and contract link from the source tags to the target tag, then soft-deletes the source tags. Any tags can be merged, not only the ones reported as duplicates.',
      security,
      requestBody: jsonBody(MergeTagsBody),
      responses: {
        200: jsonResponse(ref('TagMergeResult')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/tags/{id}': {
    get: {
      tags: ['Tags'],
      summary: 'Get tag by id',
      security,
      parameters: [idParam(), includeDeletedParam],
      responses: {
        200: jsonResponse(ref('Tag')),
        401: r[401],
        404: r[404],
      },
    },
    put: {
      tags: ['Tags'],
      summary: 'Update tag name',
      security,
      parameters: [idParam()],
      requestBody: jsonBody(CreateTagBody),
      responses: {
        200: jsonResponse(ref('Tag')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
    delete: {
      tags: ['Tags'],
      summary: 'Soft-delete tag',
      description: 'Soft-deletes the tag. Existing references in transaction version history are preserved.',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Tag')),
        401: r[401],
        404: r[404],
      },
    },
  },
  '/api/tags/{id}/restore': {
    patch: {
      tags: ['Tags'],
      summary: 'Restore a soft-deleted tag',
      description: 'Fails with 400 when an active tag with the same name already exists (e.g. the tag was merged into it).',
      security,
      parameters: [idParam()],
      responses: {
        200: jsonResponse(ref('Tag')),
        400: r[400],
        401: r[401],
        404: r[404],
      },
    },
  },
};
