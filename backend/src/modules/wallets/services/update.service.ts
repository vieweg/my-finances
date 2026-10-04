import { dataSource } from '../../../database';
import { UpdateWalletDto, WalletResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import AppError from '../../../errors/AppError';

export default class UpdateWalletService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: UpdateWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findById(dto.id, dto.userId);
    if (!wallet) throw new AppError('Wallet not found', 404);

    wallet.name = dto.name;
    await this.walletRepository.save(wallet);

    const currentBalance = await this.snapshotRepository.getLatestAmount(wallet.id);
    return this.walletRepository.formatResponse(wallet, currentBalance);
  }
}
