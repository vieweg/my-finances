import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import { GetOrDeleteWalletDto, WalletResponseDto } from '../dtos';

export default class RestoreWalletService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: GetOrDeleteWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!wallet) throw new AppError('Wallet not found', 404);
    if (!wallet.deletedAt) throw new AppError('Wallet is not deleted', 400);

    wallet.deletedAt = null as unknown as Date;
    await this.walletRepository.save(wallet);

    const currentBalance = await this.snapshotRepository.getLatestAmount(wallet.id);
    return this.walletRepository.formatResponse(wallet, currentBalance);
  }
}
