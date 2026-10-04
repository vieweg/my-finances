import Joi, { ValidationResult } from 'joi';
import { CreateUserDto, UpdateUserDto, UserChangePasswordDto } from '../dtos';

export class ValidateUser {
  static create(user: CreateUserDto): ValidationResult<CreateUserDto> {
    const schema = Joi.object({
      name: Joi.string().required(),
      username: Joi.string().trim().required(),
      email: Joi.string().email().trim().required(),
      password: Joi.string().min(6).trim().required(),
      confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match the password',
      }),
    }).options({
      abortEarly: false,
    });
    return schema.validate(user);
  }

  static update(user: UpdateUserDto): ValidationResult<UpdateUserDto> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().trim().optional(),
      username: Joi.string().trim().optional(),
      password: Joi.string().min(6).trim().optional(),
      newPassword: Joi.string().min(6).optional(),
      confirmPassword: Joi.valid(Joi.ref('newPassword')).messages({
        'any.only': 'Confirm password must match the password',
      }),
    })
      .with('password', ['confirmPassword', 'newPassword'])
      .with('newPassword', ['confirmPassword', 'password'])
      .options({
        abortEarly: false,
      });
    return schema.validate(user);
  }

  static get(userId: string): ValidationResult<string> {
    const schema = Joi.string().uuid().required();

    return schema.validate(userId);
  }

  static delete(userId: string, remove?: string): ValidationResult<{ id: string; remove: string }> {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      remove: Joi.string().valid('remove'),
    });

    return schema.validate({ id: userId, remove });
  }

  static changePassword(userData: UserChangePasswordDto): ValidationResult<UserChangePasswordDto> {
    const schema = Joi.object({
      token: Joi.string().trim().required(),
      password: Joi.string().min(6).trim().required(),
      confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match the password',
      }),
    }).options({
      abortEarly: false,
    });
    return schema.validate(userData);
  }

  static forgotPassword(email: string): ValidationResult<string> {
    const schema = Joi.string().email().trim().required();
    return schema.validate(email);
  }
}
