import { dataSource } from '../../../database';
import { GetOrDeleteWalletDto, WalletWithHistoryResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import AppError from '../../../errors/AppError';

const RECENT_SNAPSHOTS_LIMIT = 10;

export default class GetWalletService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: GetOrDeleteWalletDto): Promise<WalletWithHistoryResponseDto> {
    const wallet = await this.walletRepository.findById(dto.id, dto.userId, dto.deleted);
    if (!wallet) throw new AppError('Wallet not found', 404);

    const [snapshots, currentBalance] = await Promise.all([
      this.snapshotRepository.getRecent(wallet.id, RECENT_SNAPSHOTS_LIMIT),
      this.snapshotRepository.getLatestAmount(wallet.id),
    ]);

    return this.walletRepository.formatWithHistory(
      wallet,
      currentBalance,
      snapshots.map((s) => this.snapshotRepository.formatResponse(s)),
    );
  }
}
