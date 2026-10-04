import { DataSource, Repository, IsNull } from 'typeorm';
import { Transaction } from '../models/transactions.model';
import { ListTransactionsDto, TransactionResponseDto, HistoryResponseDto } from '../dtos/';
import { PAGINATION_TRANSACTIONS } from '../../../constants';
import WalletRepository, { formatWalletSummary } from '../../wallets/repositories/wallet.repository';
import { paginate } from '../../../utils/pagination';

export default class TransactionRepository extends Repository<Transaction> {
  private walletRepository: WalletRepository;

  constructor(dataSource: DataSource) {
    super(Transaction, dataSource.createEntityManager());
    this.walletRepository = new WalletRepository(dataSource);
  }

  // Loads soft-deleted wallets so responses can still show them; only for responses,
  // since balance updates must not reach a deleted wallet
  async withDeletedWallets<T extends Transaction | Transaction[]>(transactions: T): Promise<T> {
    await this.walletRepository.fillDeleted(Array.isArray(transactions) ? transactions : [transactions]);
    return transactions;
  }

  private versionGroupWhere(originalId: string, userId: string) {
    return [
      { id: originalId, originalId: IsNull(), user: { id: userId } },
      { originalId, user: { id: userId } },
    ];
  }

  async findLatestByOriginalId(originalId: string, userId: string, withDeleted = false): Promise<Transaction | null> {
    return this.findOne({
      where: this.versionGroupWhere(originalId, userId),
      relations: ['wallet', 'invoice'],
      order: { version: 'DESC' },
      withDeleted,
    });
  }

  async findAllVersions(originalId: string, userId: string): Promise<Transaction[]> {
    return this.find({
      where: this.versionGroupWhere(originalId, userId),
      relations: ['wallet', 'invoice'],
      order: { version: 'DESC' },
      withDeleted: true,
    });
  }

  async findVersionHistory(
    originalId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<[Transaction[], number]> {
    return this.findAndCount({
      where: this.versionGroupWhere(originalId, userId),
      relations: ['wallet', 'invoice'],
      order: { version: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      withDeleted: true,
    });
  }

  async findVersionById(
    versionId: string,
    originalId: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.findOne({
      where: [
        { id: versionId, originalId: IsNull(), user: { id: userId } },
        { id: versionId, originalId, user: { id: userId } },
      ],
      relations: ['wallet', 'invoice'],
      withDeleted: true,
    });
  }

  async findAll(params: ListTransactionsDto): Promise<[Transaction[], number]> {
    const {
      userId,
      page = PAGINATION_TRANSACTIONS.DEFAULT_PAGE,
      limit = PAGINATION_TRANSACTIONS.DEFAULT_LIMIT,
      sortBy = PAGINATION_TRANSACTIONS.SORT_BY[0],
      sortOrder = PAGINATION_TRANSACTIONS.SORT_ORDER[0],
      filterByType,
      filterByCurrency,
      filterByDateRange,
      description,
      search,
      filterByTag,
      filterByTagId,
      deleted,
    } = params;

    const direction = sortOrder.toUpperCase() as 'ASC' | 'DESC';

    const qb = this.createQueryBuilder('t')
      .leftJoinAndSelect('t.tags', 'tag')
      .leftJoinAndSelect('t.wallet', 'wallet')
      .leftJoin('t.invoice', 'invoice')
      .addSelect(['invoice.id', 'invoice.type', 'invoice.status', 'invoice.amount', 'invoice.currency'])
      .innerJoin('t.user', 'user')
      .where('user.id = :userId', { userId })
      .skip((page - 1) * limit)
      .take(limit);

    if (sortBy === 'total') {
      qb.addSelect(`CASE WHEN t.type = 'income' THEN t.total ELSE -t.total END`, 'signedTotal')
        .orderBy('signedTotal', direction);
    } else {
      qb.orderBy(`t.${sortBy}`, direction);
    }

    if (sortBy !== 'createdAt') qb.addOrderBy('t.createdAt', direction);

    if (filterByType) qb.andWhere('t.type = :filterByType', { filterByType });
    if (filterByCurrency) qb.andWhere('t.currency = :filterByCurrency', { filterByCurrency });
    if (description)
      qb.andWhere('t.description LIKE :description', { description: `%${description}%` });

    const { startDate, endDate } = filterByDateRange || {};
    const endOfDay = endDate ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) : undefined;
    if (startDate && endOfDay) {
      qb.andWhere('t.date BETWEEN :startDate AND :endDate', { startDate, endDate: endOfDay });
    } else if (startDate) {
      qb.andWhere('t.date >= :startDate', { startDate });
    } else if (endOfDay) {
      qb.andWhere('t.date <= :endDate', { endDate: endOfDay });
    }

    // Wallet names include deleted wallets, which responses still show
    if (search)
      qb.andWhere(
        `(t.description LIKE :search OR t.notes LIKE :search
          OR EXISTS (SELECT 1 FROM wallets w WHERE w.id = t.walletId AND w.name LIKE :search)
          OR EXISTS (SELECT 1 FROM transactions_tags tt INNER JOIN tags tg ON tt.tag_id = tg.id WHERE tt.transaction_id = t.id AND tg.name LIKE :search AND tg.deletedAt IS NULL))`,
        { search: `%${search}%` },
      );

    filterByTag?.forEach((term, i) => {
      const param = `tagTerm${i}`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM transactions_tags tt INNER JOIN tags tg ON tt.tag_id = tg.id WHERE tt.transaction_id = t.id AND tg.name LIKE :${param} AND tg.deletedAt IS NULL)`,
        { [param]: `%${term}%` },
      );
    });

    filterByTagId?.forEach((tagId, i) => {
      const param = `tagId${i}`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM transactions_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = :${param})`,
        { [param]: tagId },
      );
    });

    if (deleted) {
      qb
        .withDeleted()
        .andWhere('t.deletedAt IS NOT NULL')
        .andWhere(`NOT EXISTS (
          SELECT 1 FROM transactions t2
          WHERE t2.deletedAt IS NOT NULL
          AND t2.version > t.version
          AND COALESCE(t2.originalId, t2.id) = COALESCE(t.originalId, t.id)
        )`)
        .andWhere(`NOT EXISTS (
          SELECT 1 FROM transactions t3
          WHERE t3.deletedAt IS NULL
          AND COALESCE(t3.originalId, t3.id) = COALESCE(t.originalId, t.id)
        )`);
    }

    const [transactions, total] = await qb.getManyAndCount();
    return [await this.withDeletedWallets(transactions), total];
  }

  formatResponse(transaction: Transaction): TransactionResponseDto;
  formatResponse(transaction: Transaction[]): TransactionResponseDto[];
  formatResponse(
    transaction: Transaction | Transaction[],
  ): TransactionResponseDto | TransactionResponseDto[] {
    const fmt = (t: Transaction): TransactionResponseDto => ({
      id: t.originalId ?? t.id,
      versionId: t.id,
      version: t.version,
      date: t.date,
      total: {
        amount: Number(t.total),
        currency: t.currency,
      },
      description: t.description,
      type: t.type as 'income' | 'outcome',
      walletId: t.wallet?.id ?? null,
      wallet: formatWalletSummary(t.wallet),
      invoice: t.invoice
        ? { id: t.invoice.id, type: t.invoice.type, status: t.invoice.status, total: { amount: Number(t.invoice.amount), currency: t.invoice.currency } }
        : null,
      notes: t.notes ?? null,
      tags:
        t.tags?.map((tag) => ({
          id: tag.id,
          name: tag.name,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        })) || [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      ...(t.deletedAt && { deletedAt: t.deletedAt }),
    });

    return Array.isArray(transaction) ? transaction.map(fmt) : fmt(transaction);
  }

  formatHistoryResponse(
    versions: Transaction[],
    total: number,
    page: number,
    limit: number,
  ): HistoryResponseDto {
    return paginate(this.formatResponse(versions) as TransactionResponseDto[], total, page, limit);
  }

  async getSummary(
    userId: string,
    currency: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<{ lastMonthBalance: number; income: number; outcome: number }> {
    const raw = await this.createQueryBuilder('t')
      .select(
        `COALESCE(SUM(CASE WHEN t.date < :monthStart AND t.type = 'income' THEN t.total WHEN t.date < :monthStart AND t.type = 'outcome' THEN -t.total ELSE 0 END), 0)`,
        'lastMonthBalance',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.date >= :monthStart AND t.date <= :monthEnd AND t.type = 'income' THEN t.total ELSE 0 END), 0)`,
        'income',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.date >= :monthStart AND t.date <= :monthEnd AND t.type = 'outcome' THEN t.total ELSE 0 END), 0)`,
        'outcome',
      )
      .innerJoin('t.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('t.currency = :currency', { currency })
      .setParameters({ monthStart, monthEnd })
      .getRawOne();

    return {
      lastMonthBalance: Number(raw.lastMonthBalance),
      income: Number(raw.income),
      outcome: Number(raw.outcome),
    };
  }
}
