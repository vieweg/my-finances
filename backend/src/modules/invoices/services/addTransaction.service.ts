import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import UserRepository from '../../users/repositories/user.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import WalletSnapshotService from '../../wallets/services/snapshot.service';
import { AddInvoiceTransactionDto, InvoiceResponseDto } from '../dtos';

export default class AddInvoiceTransactionService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;
  private walletRepository: WalletRepository;
  private userRepository: UserRepository;
  private tagRepository: TagRepository;
  private walletSnapshotService: WalletSnapshotService;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
    this.walletSnapshotService = new WalletSnapshotService();
  }

  async execute(dto: AddInvoiceTransactionDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: dto.invoiceId, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'cancelled')
      throw new AppError('Cannot add a transaction to a cancelled invoice', 400);
    if (invoice.status === 'paid') throw new AppError('Invoice is already fully paid', 400);

    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new AppError('User not found', 401);

    const walletId = dto.walletId !== undefined ? dto.walletId : (invoice.wallet?.id ?? null);
    let currency = dto.currency ?? invoice.currency;
    let wallet = null;

    if (walletId) {
      wallet = await this.walletRepository.findById(walletId, dto.userId);
      if (!wallet) throw new AppError('Wallet not found', 404);
      currency = wallet.currency;
    }

    if (currency !== invoice.currency) {
      throw new AppError(
        `Transaction currency (${currency}) must match the invoice currency (${invoice.currency})`,
        400,
      );
    }

    const extraTags = await Promise.all(
      dto.tags?.map((tag) =>
        this.tagRepository.findOneOrCreate(
          typeof tag === 'string' ? { name: tag } : { name: tag.name, id: (tag as any).id },
          dto.userId,
        ),
      ) || [],
    );

    const invoiceTagIds = new Set((invoice.tags ?? []).map((t) => t.id));
    const mergedTags = [
      ...(invoice.tags ?? []),
      ...extraTags.filter((t) => !invoiceTagIds.has(t.id)),
    ];

    const transactionType = invoice.type === 'receivable' ? 'income' : 'outcome';

    const transaction = this.transactionRepository.create({
      user,
      invoice,
      wallet,
      total: dto.total,
      currency,
      date: dto.date,
      description: dto.description,
      notes: dto.notes ?? null,
      type: transactionType,
      tags: mergedTags,
    });
    await this.transactionRepository.save(transaction);

    if (walletId) {
      const delta = WalletSnapshotService.signedAmount(dto.total, transactionType);
      await this.walletSnapshotService.applyTransactionDelta(
        walletId,
        dto.userId,
        delta,
        transaction.id,
        dto.date,
      );
    }

    const allTransactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id } },
      relations: ['invoice', 'wallet'],
      order: { createdAt: 'ASC' },
    });
    const paidAmount = allTransactions.reduce((sum, t) => sum + Number(t.total), 0);

    await this.invoiceRepository.applyTransactionChange(invoice, paidAmount, 'transaction_added', {
      transactionId: transaction.id,
      transactionAmount: dto.total,
    });

    const summaries = await this.invoiceRepository.formatTransactionSummaries(allTransactions);

    return this.invoiceRepository.formatResponse(invoice, paidAmount, summaries);
  }
}
