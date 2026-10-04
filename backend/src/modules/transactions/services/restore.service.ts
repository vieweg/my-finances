import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import TransactionRepository from '../repositories/transaction.repository';
import UserRepository from '../../users/repositories/user.repository';
import WalletSnapshotService from '../../wallets/services/snapshot.service';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import { RestoreTransactionDto, TransactionResponseDto } from '../dtos';

export default class RestoreService {
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private walletSnapshotService: WalletSnapshotService;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
    this.walletSnapshotService = new WalletSnapshotService();
    this.invoiceRepository = new InvoiceRepository(dataSource);
  }

  async execute(dto: RestoreTransactionDto): Promise<TransactionResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    const current = await this.transactionRepository.findLatestByOriginalId(dto.id, dto.userId, true);
    if (!current) {
      throw new AppError('Transaction not found', 404);
    }

    const originalId = current.originalId ?? current.id;

    const target = await this.transactionRepository.findVersionById(dto.versionId, originalId, dto.userId);
    if (!target) {
      throw new AppError('Version not found', 404);
    }

    // Capture before softRemove mutates deletedAt in-place
    const currentWasDeleted = !!current.deletedAt;

    await this.transactionRepository.softRemove(current);

    const restored = this.transactionRepository.create({
      user,
      originalId,
      version: current.version + 1,
      total: target.total,
      currency: target.currency,
      date: target.date,
      description: target.description,
      type: target.type,
      notes: target.notes,
      wallet: target.wallet,
      tags: target.tags,
      invoice: target.invoice ?? null,
    });
    await this.transactionRepository.save(restored);

    await this.walletSnapshotService.applyWalletTransition(
      { walletId: currentWasDeleted ? null : (current.wallet?.id ?? null), total: current.total, type: current.type },
      { walletId: target.wallet?.id ?? null, total: target.total, type: target.type },
      dto.userId,
      restored.id,
      target.date,
    );
    await this.walletSnapshotService.moveTransactionEntries(originalId, target.date);

    if (target.invoice) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: target.invoice.id } });
      if (invoice) {
        const txns = await this.transactionRepository.find({ where: { invoice: { id: invoice.id } } });
        const paidAmount = txns.reduce((sum, t) => sum + Number(t.total), 0);
        await this.invoiceRepository.applyTransactionChange(invoice, paidAmount, 'transaction_updated');
      }
    }

    return this.transactionRepository.formatResponse(restored);
  }

}
