import { dataSource } from '../../../database';
import { UpdateTransactionDto, TransactionResponseDto } from '../dtos';
import TransactionRepository from '../repositories/transaction.repository';
import UserRepository from '../../users/repositories/user.repository';
import TagRepository from '../../tags/repositories/tag.repository';
import WalletRepository from '../../wallets/repositories/wallet.repository';
import WalletSnapshotService from '../../wallets/services/snapshot.service';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import AppError from '../../../errors/AppError';

export default class UpdateService {
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private tagRepository: TagRepository;
  private walletRepository: WalletRepository;
  private walletSnapshotService: WalletSnapshotService;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.tagRepository = new TagRepository(dataSource);
    this.walletRepository = new WalletRepository(dataSource);
    this.walletSnapshotService = new WalletSnapshotService();
    this.invoiceRepository = new InvoiceRepository(dataSource);
  }

  async execute(dto: UpdateTransactionDto): Promise<TransactionResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    const current = await this.transactionRepository.findLatestByOriginalId(dto.id, dto.userId);
    if (!current) {
      throw new AppError('Transaction not found', 404);
    }

    let currency = dto.currency!;
    let wallet = null;
    if (dto.walletId) {
      wallet = await this.walletRepository.findById(dto.walletId, dto.userId);
      if (!wallet) throw new AppError('Wallet not found', 404);
      currency = wallet.currency;
    }

    if (current.invoice && currency !== current.invoice.currency) {
      throw new AppError(
        `Transaction currency (${currency}) must match the invoice currency (${current.invoice.currency})`,
        400,
      );
    }

    const originalId = current.originalId ?? current.id;
    const nextVersion = current.version + 1;

    const tags = await Promise.all(
      dto.tags?.map((tag) =>
        this.tagRepository.findOneOrCreate(
          typeof tag === 'string' ? { name: tag } : { name: tag.name, id: tag.id },
          user.id,
        ),
      ) || [],
    );

    await this.transactionRepository.softRemove(current);

    const newVersion = this.transactionRepository.create({
      user,
      originalId,
      version: nextVersion,
      total: dto.total,
      currency,
      date: dto.date,
      description: dto.description,
      type: dto.type,
      // Omitting notes keeps them, so clients that don't send notes don't wipe them
      notes: dto.notes !== undefined ? dto.notes : current.notes,
      wallet,
      tags,
      invoice: current.invoice ?? null,
    });
    await this.transactionRepository.save(newVersion);

    await this.walletSnapshotService.applyWalletTransition(
      { walletId: current.wallet?.id ?? null, total: current.total, type: current.type },
      { walletId: dto.walletId ?? null, total: dto.total, type: dto.type },
      dto.userId,
      newVersion.id,
      dto.date,
    );
    await this.walletSnapshotService.moveTransactionEntries(originalId, dto.date);

    if (current.invoice) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: current.invoice.id } });
      if (invoice) {
        const txns = await this.transactionRepository.find({ where: { invoice: { id: invoice.id } } });
        const paidAmount = txns.reduce((sum, t) => sum + Number(t.total), 0);
        await this.invoiceRepository.applyTransactionChange(invoice, paidAmount, 'transaction_updated');
      }
    }

    return this.transactionRepository.formatResponse(newVersion);
  }

}
