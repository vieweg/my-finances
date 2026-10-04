import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../repositories/user.repository';
import { UserResponseDto } from '../dtos';

export default class DeleteUserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(userData: { id: string; remove: boolean }): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userData.id },
      withDeleted: true,
    });

    if (!user) {
      throw new AppError('User not found or already deleted', 404);
    }

    if (userData.remove) {
      return this.userRepository.formatResponse(await this.userRepository.remove(user));
    }

    return this.userRepository.formatResponse(await this.userRepository.softRemove(user));
  }
}
