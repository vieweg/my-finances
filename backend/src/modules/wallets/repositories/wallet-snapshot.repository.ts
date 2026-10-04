import { DataSource, Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { WalletSnapshot } from '../models/wallet-snapshot.model';
import { SnapshotResponseDto } from '../dtos';

export default class WalletSnapshotRepository extends Repository<WalletSnapshot> {
  constructor(dataSource: DataSource) {
    super(WalletSnapshot, dataSource.createEntityManager());
  }

  // withDeleted keeps the wallet join from hiding snapshots of a soft-deleted wallet (snapshots themselves are never soft-deleted)
  async getLatestAmount(walletId: string): Promise<number> {
    const latest = await this.findOne({
      where: { wallet: { id: walletId } },
      order: { recordedAt: 'DESC', createdAt: 'DESC' },
      withDeleted: true,
    });
    return latest ? Number(latest.amount) : 0;
  }

  async getHistory(
    walletId: string,
    page: number,
    limit: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<[WalletSnapshot[], number]> {
    const endOfDay = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined;
    const dateFilter =
      startDate && endOfDay
        ? Between(startDate, endOfDay)
        : startDate
          ? MoreThanOrEqual(startDate)
          : endOfDay
            ? LessThanOrEqual(endOfDay)
            : undefined;

    return this.findAndCount({
      where: {
        wallet: { id: walletId },
        ...(dateFilter && { effectiveAt: dateFilter }),
      },
      order: { effectiveAt: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findById(snapshotId: string, walletId: string): Promise<WalletSnapshot | null> {
    return this.findOne({ where: { id: snapshotId, wallet: { id: walletId } } });
  }

  async getAllOrdered(walletId: string): Promise<WalletSnapshot[]> {
    return this.find({
      where: { wallet: { id: walletId } },
      order: { recordedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  // See getLatestAmount for why withDeleted is set
  async getRecent(walletId: string, count: number): Promise<WalletSnapshot[]> {
    return this.find({
      where: { wallet: { id: walletId } },
      order: { effectiveAt: 'DESC', createdAt: 'DESC' },
      take: count,
      withDeleted: true,
    });
  }

  formatResponse(snapshot: WalletSnapshot): SnapshotResponseDto {
    return {
      id: snapshot.id,
      amount: Number(snapshot.amount),
      delta: Number(snapshot.delta),
      source: snapshot.source,
      transactionId: snapshot.transactionId,
      recordedAt: snapshot.recordedAt,
      effectiveAt: snapshot.effectiveAt,
      createdAt: snapshot.createdAt,
    };
  }
}
