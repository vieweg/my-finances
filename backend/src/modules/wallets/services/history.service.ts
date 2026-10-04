import { dataSource } from '../../../database';
import { WalletHistoryDto, SnapshotResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import AppError from '../../../errors/AppError';
import { PAGINATION_WALLETS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class WalletHistoryService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: WalletHistoryDto): Promise<PaginatedResponseDto<SnapshotResponseDto>> {
    const wallet = await this.walletRepository.findById(dto.id, dto.userId);
    if (!wallet) throw new AppError('Wallet not found', 404);

    const page = dto.page ?? PAGINATION_WALLETS.DEFAULT_PAGE;
    const limit = dto.limit ?? PAGINATION_WALLETS.DEFAULT_LIMIT;

    const [snapshots, total] = await this.snapshotRepository.getHistory(
      wallet.id,
      page,
      limit,
      dto.startDate,
      dto.endDate,
    );

    return paginate(
      snapshots.map((s) => this.snapshotRepository.formatResponse(s)),
      total,
      page,
      limit,
    );
  }
}
