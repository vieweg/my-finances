import { dataSource } from '../../../database';
import { ReorderWalletsDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import AppError from '../../../errors/AppError';

export default class ReorderWalletsService {
  private walletRepository: WalletRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
  }

  async execute(dto: ReorderWalletsDto): Promise<void> {
    const [wallets] = await this.walletRepository.findAll({ userId: dto.userId, currency: dto.currency, limit: 1000 });

    if (wallets.length !== dto.ids.length) {
      const scope = dto.currency ? `for currency ${dto.currency}` : '';
      throw new AppError(`All wallet IDs must be provided for reordering${scope ? ' ' + scope : ''}`, 400);
    }

    const walletMap = new Map(wallets.map((w) => [w.id, w]));

    for (const id of dto.ids) {
      if (!walletMap.has(id)) throw new AppError(`Wallet ${id} not found`, 404);
    }

    await Promise.all(
      dto.ids.map((id, index) => {
        const wallet = walletMap.get(id)!;
        wallet.position = index + 1;
        return this.walletRepository.save(wallet);
      }),
    );
  }
}
