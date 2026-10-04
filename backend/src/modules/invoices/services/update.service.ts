import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import ContactRepository from '../../contacts/repositories/contact.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { UpdateInvoiceDto, InvoiceResponseDto } from '../dtos';

export default class UpdateInvoiceService {
  private invoiceRepository: InvoiceRepository;
  private contactRepository: ContactRepository;
  private walletRepository: WalletRepository;
  private tagRepository: TagRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.contactRepository = new ContactRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: UpdateInvoiceDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(dto.id, dto.userId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'cancelled') throw new AppError('Cannot update a cancelled invoice', 400);

    const changes: Record<string, unknown> = {};

    if (dto.contactId && dto.contactId !== invoice.contact.id) {
      const contact = await this.contactRepository.findById(dto.contactId, dto.userId);
      if (!contact) throw new AppError('Contact not found', 404);
      changes.contactId = dto.contactId;
      invoice.contact = contact;
    }

    if (dto.walletId !== undefined) {
      if (dto.walletId === null) {
        changes.walletId = null;
        invoice.wallet = null;
      } else {
        const wallet = await this.walletRepository.findById(dto.walletId, dto.userId);
        if (!wallet) throw new AppError('Wallet not found', 404);
        changes.walletId = dto.walletId;
        invoice.wallet = wallet;
        if (wallet.currency !== invoice.currency) {
          const txCount = await this.transactionRepository.count({
            where: { invoice: { id: invoice.id } },
            withDeleted: true,
          });
          if (txCount > 0) throw new AppError('Cannot change invoice currency: invoice already has linked transactions', 400);
          changes.currency = wallet.currency;
          invoice.currency = wallet.currency;
        }
      }
    }

    if (dto.tags !== undefined) {
      invoice.tags = await Promise.all(
        dto.tags.map((tag) =>
          this.tagRepository.findOneOrCreate(
            typeof tag === 'string' ? { name: tag } : { name: tag.name, id: (tag as any).id },
            dto.userId,
          ),
        ),
      );
    }

    if (dto.currency !== undefined && dto.currency !== invoice.currency) {
      const txCount = await this.transactionRepository.count({
        where: { invoice: { id: invoice.id } },
        withDeleted: true,
      });
      if (txCount > 0) throw new AppError('Cannot change invoice currency: invoice already has linked transactions', 400);
    }

    const simpleFields = ['amount', 'currency', 'issueDate', 'dueDate', 'description', 'notes'] as const;
    for (const field of simpleFields) {
      if (dto[field] !== undefined && dto[field] !== (invoice as any)[field]) {
        changes[field] = dto[field];
        (invoice as any)[field] = dto[field];
      }
    }

    const transactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id } },
    });
    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    if (Object.keys(changes).length > 0) {
      if (changes.amount !== undefined) {
        invoice.status =
          paidAmount >= Number(invoice.amount) ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
      }
      invoice.history = [
        ...invoice.history,
        { event: 'updated', at: new Date().toISOString(), status: invoice.status, changes },
      ];
      await this.invoiceRepository.save(invoice);
    }

    return this.invoiceRepository.formatResponse(invoice, paidAmount);
  }
}
