import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../../users/repositories/user.repository';
import ContactRepository from '../../contacts/repositories/contact.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import ContractRepository from '../repositories/contract.repository';
import GenerateContractInvoicesService from './generateInvoices.service';
import { CreateContractDto, ContractResponseDto } from '../dtos';

export default class CreateContractService {
  private contractRepository: ContractRepository;
  private userRepository: UserRepository;
  private contactRepository: ContactRepository;
  private walletRepository: WalletRepository;
  private tagRepository: TagRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.contactRepository = new ContactRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
  }

  async execute(dto: CreateContractDto): Promise<ContractResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new AppError('User not found', 401);

    const contact = await this.contactRepository.findById(dto.contactId, dto.userId);
    if (!contact) throw new AppError('Contact not found', 404);

    const wallet = dto.walletId
      ? await this.walletRepository.findById(dto.walletId, dto.userId)
      : null;
    if (dto.walletId && !wallet) throw new AppError('Wallet not found', 404);

    const currency = wallet ? wallet.currency : dto.currency!;

    const tags = await Promise.all(
      dto.tags?.map((tag) =>
        this.tagRepository.findOneOrCreate(
          typeof tag === 'string' ? { name: tag } : { name: (tag as any).name, id: (tag as any).id },
          dto.userId,
        ),
      ) || [],
    );

    const contract = this.contractRepository.create({
      user,
      name: dto.name,
      contact,
      wallet: wallet ?? null,
      type: dto.type,
      amount: dto.amount,
      currency,
      description: dto.description,
      notes: dto.notes ?? null,
      tags,
      instalments: dto.instalments,
      instalmentsDone: 0,
      cycleMonths: dto.cycleMonths,
      firstDueDate: dto.firstDueDate,
      nextDueDate: dto.firstDueDate,
      status: 'active',
    });
    await this.contractRepository.save(contract);

    if (new Date(dto.firstDueDate) <= new Date()) {
      await new GenerateContractInvoicesService().generateOne(contract);
    }

    return this.contractRepository.formatResponse(contract);
  }
}
