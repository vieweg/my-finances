import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import TransactionRepository from '../repositories/transaction.repository';
import { TransactionResponseDto, TransactionWithHistoryResponseDto, GetOrDeleteTransactionDto } from '../dtos';

const INLINE_HISTORY_LIMIT = 5;

export default class GetService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute({ userId, id, deleted }: GetOrDeleteTransactionDto): Promise<TransactionWithHistoryResponseDto> {
    if (!id || !userId) {
      throw new AppError('User ID and Transaction ID are required', 400);
    }

    const latest = await this.transactionRepository.findLatestByOriginalId(id, userId, deleted);
    if (!latest) {
      throw new AppError('Transaction not found', 404);
    }

    const originalId = latest.originalId ?? latest.id;
    const [allVersions] = await this.transactionRepository.findVersionHistory(
      originalId,
      userId,
      1,
      INLINE_HISTORY_LIMIT + 1,
    );

    // allVersions is ordered version DESC; first item is the current one
    const previousVersions = allVersions.filter((v) => v.id !== latest.id).slice(0, INLINE_HISTORY_LIMIT);
    await this.transactionRepository.withDeletedWallets([latest, ...previousVersions]);

    return {
      ...this.transactionRepository.formatResponse(latest),
      history: this.transactionRepository.formatResponse(previousVersions) as TransactionResponseDto[],
    };
  }
}
