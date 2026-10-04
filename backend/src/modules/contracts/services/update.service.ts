import { addMonths } from 'date-fns';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContactRepository from '../../contacts/repositories/contact.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import ContractRepository from '../repositories/contract.repository';
import { UpdateContractDto, ContractResponseDto } from '../dtos';

export default class UpdateContractService {
  private contractRepository: ContractRepository;
  private contactRepository: ContactRepository;
  private walletRepository: WalletRepository;
  private tagRepository: TagRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
    this.contactRepository = new ContactRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
  }

  async execute(dto: UpdateContractDto): Promise<ContractResponseDto> {
    const contract = await this.contractRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!contract) throw new AppError('Contract not found', 404);
    if (contract.status === 'cancelled' || contract.deletedAt) throw new AppError('Cannot update a cancelled contract', 400);

    if (dto.contactId && dto.contactId !== contract.contact.id) {
      const contact = await this.contactRepository.findById(dto.contactId, dto.userId);
      if (!contact) throw new AppError('Contact not found', 404);
      contract.contact = contact;
    }

    if (dto.walletId !== undefined) {
      if (dto.walletId === null) {
        contract.wallet = null;
        if (dto.currency) contract.currency = dto.currency;
      } else {
        const wallet = await this.walletRepository.findById(dto.walletId, dto.userId);
        if (!wallet) throw new AppError('Wallet not found', 404);
        contract.wallet = wallet;
        contract.currency = wallet.currency;
      }
    } else if (dto.currency) {
      contract.currency = dto.currency;
    }

    if (dto.tags !== undefined) {
      contract.tags = await Promise.all(
        dto.tags.map((tag) =>
          this.tagRepository.findOneOrCreate(
            typeof tag === 'string' ? { name: tag } : { name: (tag as any).name, id: (tag as any).id },
            dto.userId,
          ),
        ),
      );
    }

    if (dto.name !== undefined) contract.name = dto.name;
    if (dto.description !== undefined) contract.description = dto.description;
    if (dto.notes !== undefined) contract.notes = dto.notes;
    if (dto.amount !== undefined) contract.amount = dto.amount;

    const cycleChanged = dto.cycleMonths !== undefined && dto.cycleMonths !== contract.cycleMonths;
    const firstDueDateChanged = dto.firstDueDate !== undefined;

    const instalmentsChanged = dto.instalments !== undefined && dto.instalments !== contract.instalments;

    if (dto.cycleMonths !== undefined) contract.cycleMonths = dto.cycleMonths;
    if (dto.firstDueDate !== undefined) contract.firstDueDate = dto.firstDueDate;
    if (dto.instalments !== undefined) contract.instalments = dto.instalments;

    if (cycleChanged || firstDueDateChanged) {
      // Recompute nextDueDate from firstDueDate advanced by instalmentsDone cycles
      let next = new Date(contract.firstDueDate);
      for (let i = 0; i < contract.instalmentsDone; i++) {
        next = addMonths(next, contract.cycleMonths);
      }
      contract.nextDueDate = next;
    }

    const hasRemainingInstalments = contract.instalments === 0 || contract.instalmentsDone < contract.instalments;
    if (!hasRemainingInstalments) {
      contract.status = 'completed';
    } else if (contract.status === 'completed' && instalmentsChanged) {
      // Raising the instalments reopens the contract. Other edits keep a manually completed contract completed.
      contract.status = 'active';
    }

    await this.contractRepository.save(contract);
    return this.contractRepository.formatResponse(contract);
  }
}
