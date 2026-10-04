import { dataSource } from '../../../database';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import AppError from '../../../errors/AppError';

export default class RemoveSnapshotService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(walletId: string, snapshotId: string, userId: string): Promise<void> {
    const wallet = await this.walletRepository.findById(walletId, userId);
    if (!wallet) throw new AppError('Wallet not found', 404);

    const snapshot = await this.snapshotRepository.findById(snapshotId, walletId);
    if (!snapshot) throw new AppError('Snapshot not found', 404);
    if (snapshot.source !== 'manual') throw new AppError('Only manual adjustments can be deleted', 400);

    const all = await this.snapshotRepository.getAllOrdered(walletId);
    const idx = all.findIndex((s) => s.id === snapshotId);

    // "next" = more recent entry (lower index), "prev" = older entry (higher index)
    const next = idx > 0 ? all[idx - 1] : null;
    const prev = idx < all.length - 1 ? all[idx + 1] : null;

    await this.snapshotRepository.remove(snapshot);

    if (next) {
      const prevAmount = prev ? Number(prev.amount) : 0;
      next.delta = Number(next.amount) - prevAmount;
      await this.snapshotRepository.save(next);
    }
  }
}
