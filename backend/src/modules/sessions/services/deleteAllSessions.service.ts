import { DeleteResult } from 'typeorm';
import { dataSource } from '../../../database';
import SessionRepository from '../repositories/session.repository';
import AppError from '../../../errors/AppError';

export default class DeleteAllSessionsService {
  private sessionRepository: SessionRepository;

  constructor() {
    this.sessionRepository = new SessionRepository(dataSource);
  }

  async execute(userId: string): Promise<DeleteResult> {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    return this.sessionRepository.delete({ user: { id: userId } });
  }
}
