import { dataSource } from '../../../database';
import { ListWalletDto, WalletResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import { PAGINATION_WALLETS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class ListWalletService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: ListWalletDto): Promise<PaginatedResponseDto<WalletResponseDto>> {
    const [wallets, total] = await this.walletRepository.findAll(dto);

    const data = await Promise.all(
      wallets.map(async (wallet) => {
        const currentBalance = await this.snapshotRepository.getLatestAmount(wallet.id);
        return this.walletRepository.formatResponse(wallet, currentBalance);
      }),
    );

    return paginate(data, total, dto.page ?? PAGINATION_WALLETS.DEFAULT_PAGE, dto.limit ?? PAGINATION_WALLETS.DEFAULT_LIMIT);
  }
}
