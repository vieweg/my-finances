import { dataSource } from '../../../database';
import TransactionRepository from '../repositories/transaction.repository';
import { TransactionResponseDto, ListTransactionsDto } from '../dtos';
import { PAGINATION_TRANSACTIONS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class ListService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(params: ListTransactionsDto): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    const [transactions, total] = await this.transactionRepository.findAll(params);

    return paginate(
      this.transactionRepository.formatResponse(transactions),
      total,
      params.page ?? PAGINATION_TRANSACTIONS.DEFAULT_PAGE,
      params.limit ?? PAGINATION_TRANSACTIONS.DEFAULT_LIMIT,
    );
  }
}
