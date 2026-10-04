import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../../users/repositories/user.repository';
import ContactRepository from '../../contacts/repositories/contact.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import InvoiceRepository from '../repositories/invoice.repository';
import { CreateInvoiceDto, InvoiceResponseDto } from '../dtos';

export default class CreateInvoiceService {
  private invoiceRepository: InvoiceRepository;
  private userRepository: UserRepository;
  private contactRepository: ContactRepository;
  private walletRepository: WalletRepository;
  private tagRepository: TagRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.contactRepository = new ContactRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
  }

  async execute(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
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
          typeof tag === 'string' ? { name: tag } : { name: tag.name, id: (tag as any).id },
          dto.userId,
        ),
      ) || [],
    );

    const now = new Date().toISOString();
    const invoice = this.invoiceRepository.create({
      user,
      contact,
      wallet: wallet ?? null,
      type: dto.type,
      status: 'pending',
      amount: dto.amount,
      currency,
      issueDate: dto.issueDate,
      dueDate: dto.dueDate,
      description: dto.description ?? null,
      notes: dto.notes ?? null,
      tags,
      history: [{ event: 'created', at: now, status: 'pending' }],
    });
    await this.invoiceRepository.save(invoice);

    return this.invoiceRepository.formatResponse(invoice, 0);
  }
}
