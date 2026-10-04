import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import TransactionRepository from '../repositories/transaction.repository';
import RestoreService from './restore.service';
import { GetOrDeleteTransactionDto, TransactionResponseDto } from '../dtos';

// Undoes a soft-delete by restoring the latest version. Delegates to the version restore,
// which re-applies the wallet balance and recalculates the linked invoice status.
export default class RestoreDeletedService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute({ id, userId }: GetOrDeleteTransactionDto): Promise<TransactionResponseDto> {
    if (!id || !userId) {
      throw new AppError('User ID and Transaction ID are required', 400);
    }

    const latest = await this.transactionRepository.findLatestByOriginalId(id, userId, true);
    if (!latest) throw new AppError('Transaction not found', 404);
    if (!latest.deletedAt) throw new AppError('Transaction is not deleted', 400);

    return new RestoreService().execute({ id, versionId: latest.id, userId });
  }
}
