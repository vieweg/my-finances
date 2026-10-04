import { dataSource } from '../../../database';
import { CreateWalletDto, WalletResponseDto } from '../dtos';
import WalletRepository from '../repositories/wallet.repository';
import UserRepository from '../../users/repositories/user.repository';
import AppError from '../../../errors/AppError';

export default class CreateWalletService {
  private walletRepository: WalletRepository;
  private userRepository: UserRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(dto: CreateWalletDto): Promise<WalletResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new AppError('User not found', 401);

    const position = await this.walletRepository.getMaxPosition(dto.userId) + 1;
    const wallet = this.walletRepository.create({ user, name: dto.name, currency: dto.currency, position });
    await this.walletRepository.save(wallet);

    return this.walletRepository.formatResponse(wallet, 0);
  }
}
