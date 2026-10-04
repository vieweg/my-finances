import { dataSource } from '../../../database';
import { AddTransactionDto, TransactionResponseDto } from '../dtos';
import TransactionRepository from '../repositories/transaction.repository';
import UserRepository from '../../users/repositories/user.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import WalletSnapshotService from '../../wallets/services/snapshot.service';
import AppError from '../../../errors/AppError';

export default class CreateService {
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private tagRepository: TagRepository;
  private walletRepository: WalletRepository;
  private walletSnapshotService: WalletSnapshotService;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.walletSnapshotService = new WalletSnapshotService();
  }

  async execute(dto: AddTransactionDto): Promise<TransactionResponseDto> {
    const user = await this.userRepository.findById(dto.userId);

    if (!user) {
      throw new AppError('User not found', 401);
    }

    let currency = dto.currency!;
    let wallet = null;
    if (dto.walletId) {
      wallet = await this.walletRepository.findById(dto.walletId, dto.userId);
      if (!wallet) throw new AppError('Wallet not found', 404);
      currency = wallet.currency;
    }

    const tags = await Promise.all(
      dto.tags?.map((tag) => {
        return this.tagRepository.findOneOrCreate(
          typeof tag === 'string' ? { name: tag } : { name: tag.name, id: tag.id },
          user.id,
        );
      }) || [],
    );

    const transaction = this.transactionRepository.create({
      user,
      ...dto,
      currency,
      wallet,
      tags,
    });
    await this.transactionRepository.save(transaction);

    if (dto.walletId) {
      const delta = WalletSnapshotService.signedAmount(dto.total, dto.type);
      await this.walletSnapshotService.applyTransactionDelta(dto.walletId, dto.userId, delta, transaction.id, dto.date);
    }

    return this.transactionRepository.formatResponse(transaction);
  }
}
