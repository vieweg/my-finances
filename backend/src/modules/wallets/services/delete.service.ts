import { dataSource } from '../../../database';
import { GetOrDeleteWalletDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import AppError from '../../../errors/AppError';

export default class DeleteWalletService {
  private walletRepository: WalletRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
  }

  async execute(dto: GetOrDeleteWalletDto): Promise<void> {
    const wallet = await this.walletRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!wallet) throw new AppError('Wallet not found', 404);

    if (dto.remove) {
      await this.walletRepository.remove(wallet);
      return;
    }

    await this.walletRepository.softRemove(wallet);
  }
}
