import { DeleteResult } from 'typeorm';
import { dataSource } from '../../../database';
import SessionRepository from '../repositories/session.repository';

export default class DeleteSessionService {
  private sessionRepository: SessionRepository;

  constructor() {
    this.sessionRepository = new SessionRepository(dataSource);
  }

  async execute(token: string): Promise<DeleteResult> {
    return await this.sessionRepository.delete({ token });
  }
}
