import ms from 'ms';
import { sign, verify, SignOptions, TokenExpiredError } from 'jsonwebtoken';
import { dataSource } from '../../../database';
import { SessionResponseDto } from '../dtos';
import SessionRepository, { hashRefreshToken } from '../repositories/session.repository';
import UserRepository from '../../users/repositories/user.repository';
import AppError from '../../../errors/AppError';

export default class RefreshSessionService {
  private sessionRepository: SessionRepository;
  private userRepository: UserRepository;

  constructor() {
    this.sessionRepository = new SessionRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(receivedToken: string): Promise<SessionResponseDto> {
    try {
      const tokenSecret = process.env.JWT_SECRET || 'some-secret-key';
      const refreshSecret = process.env.JWT_SECRET_REFRESH || 'some-secret-key';
      const tokenExpiresIn = process.env.JWT_EXPIRATION || '15m';
      const refreshExpiresIn = process.env.JWT_EXPIRATION_REFRESH || '7d';

      verify(receivedToken, refreshSecret);

      const storedRefreshToken = await this.sessionRepository.findByRefreshToken(receivedToken);

      if (!storedRefreshToken) {
        throw new AppError('Refresh token invalid or not found', 401);
      }

      const user = await this.userRepository.findById(storedRefreshToken.user.id);
      if (!user) {
        await this.sessionRepository.delete({ refreshToken: hashRefreshToken(receivedToken) });
        throw new AppError('Refresh token invalid or not found', 401);
      }

      // create new JWT tokens

      const tokenOptions = { expiresIn: tokenExpiresIn } as SignOptions;
      const token = sign({ id: user.id, timestamp: new Date() }, tokenSecret, tokenOptions);

      const refreshOptions = { expiresIn: refreshExpiresIn } as SignOptions;
      const refreshToken = sign(
        { id: user.id, timestamp: new Date() },
        refreshSecret,
        refreshOptions,
      );

      // Calculate expiresAt using
      const expiresInMs = ms(refreshExpiresIn as ms.StringValue);
      const expiresAt = new Date(Date.now() + (typeof expiresInMs === 'number' ? expiresInMs : 0));

      await this.sessionRepository.save({
        id: storedRefreshToken.id,
        refreshToken: hashRefreshToken(refreshToken),
        token,
        expiresAt,
      });

      return {
        refreshToken,
        token,
        user: { id: user.id, name: user.name, email: user.email, username: user.username },
      };
    } catch (error) {
      if (!(error instanceof AppError) && !(error instanceof TokenExpiredError)) {
        console.error(error);
      }
      await this.sessionRepository.delete({ refreshToken: hashRefreshToken(receivedToken) });
      throw new AppError('Refresh token invalid or expired', 401);
    }
  }
}
