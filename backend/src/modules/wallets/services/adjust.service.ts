import { dataSource } from '../../../database';
import { AdjustWalletDto, WalletResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import AppError from '../../../errors/AppError';

export default class AdjustWalletService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: AdjustWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findById(dto.id, dto.userId);
    if (!wallet) throw new AppError('Wallet not found', 404);

    const currentBalance = await this.snapshotRepository.getLatestAmount(wallet.id);
    const delta = Number(dto.amount) - currentBalance;

    const recordedAt = dto.recordedAt ?? new Date();
    const snapshot = this.snapshotRepository.create({
      wallet,
      amount: dto.amount,
      delta,
      source: 'manual',
      transactionId: null,
      recordedAt,
      effectiveAt: recordedAt,
    });
    await this.snapshotRepository.save(snapshot);

    return this.walletRepository.formatResponse(wallet, dto.amount);
  }
}
