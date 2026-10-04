import { DataSource, Repository, Not, IsNull, In } from 'typeorm';
import { Wallet } from '../models/wallet.model';
import { ListWalletDto, WalletResponseDto, WalletWithHistoryResponseDto, SnapshotResponseDto, WalletSummaryDto } from '../dtos';
import { PAGINATION_WALLETS } from '../../../constants';

// Wallet as embedded in transactions, invoices and contracts
export const formatWalletSummary = (wallet: Wallet | null | undefined): WalletSummaryDto | null =>
  wallet
    ? { id: wallet.id, name: wallet.name, currency: wallet.currency, deletedAt: wallet.deletedAt ?? null }
    : null;

export default class WalletRepository extends Repository<Wallet> {
  constructor(dataSource: DataSource) {
    super(Wallet, dataSource.createEntityManager());
  }

  async findById(id: string, userId: string, withDeleted = false): Promise<Wallet | null> {
    return this.findOne({ where: { id, user: { id: userId } }, withDeleted });
  }

  async findAll(params: ListWalletDto): Promise<[Wallet[], number]> {
    const {
      userId,
      page = PAGINATION_WALLETS.DEFAULT_PAGE,
      limit = PAGINATION_WALLETS.DEFAULT_LIMIT,
      sortBy = PAGINATION_WALLETS.SORT_BY[0],
      sortOrder = PAGINATION_WALLETS.SORT_ORDER[0],
    } = params;

    return this.findAndCount({
      where: {
        user: { id: userId },
        ...(params.currency && { currency: params.currency }),
        ...(params.deleted && { deletedAt: Not(IsNull()) }),
      },
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      ...(params.deleted && { withDeleted: true }),
    });
  }

  // Relations skip soft-deleted rows, so a record whose wallet was deleted loads with no wallet.
  // Loads those wallets from the walletId foreign key, deleted ones included.
  async fillDeleted<T extends { wallet: Wallet | null; walletId: string | null }>(items: T[]): Promise<T[]> {
    const missing = items.filter((item) => item.walletId && !item.wallet);
    if (!missing.length) return items;

    const wallets = await this.find({
      where: { id: In([...new Set(missing.map((item) => item.walletId!))]) },
      withDeleted: true,
    });
    const byId = new Map(wallets.map((w) => [w.id, w]));
    for (const item of missing) item.wallet = byId.get(item.walletId!) ?? null;
    return items;
  }

  async getMaxPosition(userId: string): Promise<number> {
    const last = await this.findOne({
      where: { user: { id: userId } },
      order: { position: 'DESC' },
    });
    return last?.position ?? 0;
  }

  formatResponse(wallet: Wallet, currentBalance: number): WalletResponseDto {
    return {
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      currentBalance,
      position: wallet.position,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      ...(wallet.deletedAt && { deletedAt: wallet.deletedAt }),
    };
  }

  formatWithHistory(
    wallet: Wallet,
    currentBalance: number,
    recentSnapshots: SnapshotResponseDto[],
  ): WalletWithHistoryResponseDto {
    return {
      ...this.formatResponse(wallet, currentBalance),
      recentSnapshots,
    };
  }
}
