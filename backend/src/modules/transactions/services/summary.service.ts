import { dataSource } from '../../../database';
import TransactionRepository from '../repositories/transaction.repository';
import { TransactionSummaryDto, TransactionSummaryResponseDto } from '../dtos';

export default class SummaryService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute({ userId, month, year, currency }: TransactionSummaryDto): Promise<TransactionSummaryResponseDto> {
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const { lastMonthBalance, income, outcome } = await this.transactionRepository.getSummary(
      userId,
      currency,
      monthStart,
      monthEnd,
    );

    const balance = income - outcome;
    const availableBalance = lastMonthBalance + balance;

    return { currency, month, year, lastMonthBalance, income, outcome, balance, availableBalance };
  }
}
