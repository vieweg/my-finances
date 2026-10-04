import bcrypt from 'bcrypt';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../repositories/user.repository';
import { CreateUserDto, UserResponseDto } from '../dtos/';

export default class CreateUserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(userData: CreateUserDto): Promise<UserResponseDto> {
    const userByEmail = await this.userRepository.findByEmailOrUsername(userData.email, true);
    const userByUsername = await this.userRepository.findByEmailOrUsername(userData.username, true);

    if (userByEmail || userByUsername) {
      throw new AppError('Username or email provided was already taken', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({ ...userData, password: hashedPassword }),
    );

    return this.userRepository.formatResponse(user);
  }
}
