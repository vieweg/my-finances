import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import TransactionRepository from '../repositories/transaction.repository';
import { HistoryTransactionDto, HistoryResponseDto } from '../dtos';
import { PAGINATION_TRANSACTIONS } from '../../../constants';

export default class HistoryService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: HistoryTransactionDto): Promise<HistoryResponseDto> {
    const { id, userId, page = PAGINATION_TRANSACTIONS.DEFAULT_PAGE, limit = PAGINATION_TRANSACTIONS.DEFAULT_LIMIT } = dto;

    const allVersions = await this.transactionRepository.findAllVersions(id, userId);
    if (!allVersions.length) {
      throw new AppError('Transaction not found', 404);
    }

    const [versions, total] = await this.transactionRepository.findVersionHistory(id, userId, page, limit);
    await this.transactionRepository.withDeletedWallets(versions);

    return this.transactionRepository.formatHistoryResponse(versions, total, page, limit);
  }
}
