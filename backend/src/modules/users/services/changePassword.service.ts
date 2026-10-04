import bcrypt from 'bcrypt';
import { verify } from 'jsonwebtoken';
import { dataSource } from '../../../database';
import UserRepository from '../repositories/user.repository';
import AppError from '../../../errors/AppError';
import { UserChangePasswordDto, UserResponseDto } from '../dtos/';

interface ResetTokenPayload {
  id: string;
  resetToken: string;
}

export default class ChangePasswordService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(userData: UserChangePasswordDto): Promise<UserResponseDto> {
    let userId: string;
    let resetToken: string;

    // Only catch JWT errors — DB/other errors must propagate normally
    try {
      const secret = process.env.JWT_RESET_SECRET!;
      const payload = verify(userData.token, secret) as ResetTokenPayload;
      userId = payload.id;
      resetToken = payload.resetToken;
    } catch {
      throw new AppError('Token invalid or expired', 400);
    }

    const user = await this.userRepository.findOneBy({ resetToken, id: userId });
    if (!user) {
      throw new AppError('Token invalid or expired', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    Object.assign(user, { password: hashedPassword, resetToken: null });
    await this.userRepository.update(user.id, user);

    return this.userRepository.formatResponse(user);
  }
}
