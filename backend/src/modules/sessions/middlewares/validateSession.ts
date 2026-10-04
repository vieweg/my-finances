import Joi, { ValidationResult } from 'joi';
import { CreateSessionDto } from '../dtos';

export class ValidateSession {
  static create(credentials: CreateSessionDto): ValidationResult<CreateSessionDto> {
    const schema = Joi.object({
      username: Joi.string().trim().required(),
      password: Joi.string().trim().max(128).required(),
    }).options({
      abortEarly: false,
    });
    return schema.validate(credentials);
  }

  static destroy(token: string | null): ValidationResult<string> {
    const schema = Joi.string().trim().required();
    return schema.validate(token);
  }

  static refresh(refreshToken: string): ValidationResult<string> {
    const schema = Joi.string().trim().required();
    return schema.validate(refreshToken);
  }
}
