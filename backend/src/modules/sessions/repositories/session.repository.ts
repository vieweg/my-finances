import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Session } from '../models/session.model';

export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export default class SessionRepository extends Repository<Session> {
  constructor(dataSource: DataSource) {
    super(Session, dataSource.createEntityManager());
  }

  async findByRefreshToken(token: string): Promise<Session | null> {
    if (!token) {
      return null;
    }
    return this.findOne({ where: { refreshToken: hashRefreshToken(token) }, relations: ['user'] });
  }
}
