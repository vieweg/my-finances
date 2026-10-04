import bcrypt from 'bcrypt';
import ms from 'ms';
import { sign, SignOptions } from 'jsonwebtoken';
import { dataSource } from '../../../database';
import { CreateSessionDto, SessionResponseDto } from '../dtos';
import SessionRepository, { hashRefreshToken } from '../repositories/session.repository';
import UserRepository from '../../users/repositories/user.repository';
import AppError from '../../../errors/AppError';

export default class CreateSessionService {
  private sessionRepository: SessionRepository;
  private userRepository: UserRepository;

  constructor() {
    this.sessionRepository = new SessionRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(dto: CreateSessionDto): Promise<SessionResponseDto> {
    const user = await this.userRepository.findByEmailOrUsername(dto.username);
    if (!user) {
      throw new AppError('User not found or wrong credetials', 401);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new AppError('User not found or wrong credetials', 401);
    }

    // create JWT tokens
    const tokenSecret = process.env.JWT_SECRET!;
    const tokenExpiresIn = process.env.JWT_EXPIRATION || '15m';
    const tokenOptions = { expiresIn: tokenExpiresIn } as SignOptions;
    const token = sign({ id: user.id, timestamp: new Date() }, tokenSecret, tokenOptions);

    const refreshSecret = process.env.JWT_SECRET_REFRESH!;
    const refreshExpiresIn = process.env.JWT_EXPIRATION_REFRESH || '7d';
    const refreshOptions = { expiresIn: refreshExpiresIn } as SignOptions;

    const refreshToken = sign(
      { id: user.id, timestamp: new Date() },
      refreshSecret,
      refreshOptions,
    );

    // Calculate expiresAt using
    const expiresInMs = ms(refreshExpiresIn as ms.StringValue);
    const expiresAt = new Date(Date.now() + (typeof expiresInMs === 'number' ? expiresInMs : 0));

    const session = this.sessionRepository.create({
      user,
      refreshToken: hashRefreshToken(refreshToken),
      token,
      expiresAt,
    });
    await this.sessionRepository.save(session);

    return {
      refreshToken,
      token,
      user: { id: user.id, name: user.name, email: user.email, username: user.username },
    };
  }
}
