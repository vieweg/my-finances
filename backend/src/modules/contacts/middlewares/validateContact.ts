import Joi, { ValidationResult } from 'joi';
import { CreateContactDto, UpdateContactDto, ContactQueryDto, ListContactsDto } from '../dtos';

export class ValidateContact {
  static create(data: CreateContactDto): ValidationResult<CreateContactDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().required(),
      document: Joi.string().trim().optional().allow(null),
      email: Joi.string().email().trim().optional().allow(null),
      phone: Joi.string().trim().optional().allow(null),
      notes: Joi.string().trim().optional().allow(null),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }

  static update(data: UpdateContactDto): ValidationResult<UpdateContactDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      name: Joi.string().trim().optional(),
      document: Joi.string().trim().allow(null, '').optional(),
      email: Joi.string().email().trim().allow(null, '').optional(),
      phone: Joi.string().trim().allow(null, '').optional(),
      notes: Joi.string().trim().allow(null, '').optional(),
    }).options({ abortEarly: false });
    return schema.validate(data);
  }

  static query(data: ContactQueryDto): ValidationResult<ContactQueryDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      remove: Joi.string().valid('remove').optional(),
      deleted: Joi.boolean().optional(),
    });
    return schema.validate(data);
  }

  static list(data: ListContactsDto): ValidationResult<ListContactsDto> {
    const schema = Joi.object({
      userId: Joi.string().uuid().required(),
      deleted: Joi.boolean().optional(),
      name: Joi.string().trim().optional(),
      email: Joi.string().trim().optional(),
      sortBy: Joi.string().valid('name', 'email', 'createdAt', 'updatedAt').optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
    });
    return schema.validate(data);
  }
}
