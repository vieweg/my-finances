import { dataSource } from '../../../database';
import { User } from '../models/user.model';
import AppError from '../../../errors/AppError';
import UserRepository from '../repositories/user.repository';
import { UserResponseDto } from '../dtos/';

export default class GetUsersService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(userId?: string): Promise<UserResponseDto | UserResponseDto[]> {
    if (userId) {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Remove sensitive data before returning
      const { password, deletedAt, resetToken, ...safeUser } = user;
      return safeUser;
    }

    const users = await this.userRepository.findAll();

    return this.userRepository.formatResponse(users);
  }
}
