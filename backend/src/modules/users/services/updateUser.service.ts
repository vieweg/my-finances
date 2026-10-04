import bcrypt from 'bcrypt';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../repositories/user.repository';
import { UpdateUserDto, UserResponseDto } from '../dtos/';

export default class UpdateUserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(userData: UpdateUserDto): Promise<UserResponseDto> {
    const { password, newPassword, confirmPassword, ...fields } = userData;
    const patch: Partial<typeof userData> = { ...fields };

    const user = await this.userRepository.findById(fields.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (fields.username && fields.username !== user.username) {
      const takenByUsername = await this.userRepository.findByEmailOrUsername(fields.username, true);
      if (takenByUsername) {
        throw new AppError('Username or email provided was already taken', 400);
      }
    }

    if (password && newPassword) {
      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 401);
      }
      patch.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await this.userRepository.save(this.userRepository.merge(user, patch));
    return this.userRepository.formatResponse(updatedUser);
  }
}
