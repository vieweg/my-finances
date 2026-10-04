import { dataSource } from '../../../database';
import TransactionRepository from '../repositories/transaction.repository';
import { GetOrDeleteTransactionDto, TransactionResponseDto } from '../dtos';
import WalletSnapshotService from '../../wallets/services/snapshot.service';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import AppError from '../../../errors/AppError';

export default class DeleteService {
  private transactionRepository: TransactionRepository;
  private walletSnapshotService: WalletSnapshotService;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository(dataSource);
    this.walletSnapshotService = new WalletSnapshotService();
    this.invoiceRepository = new InvoiceRepository(dataSource);
  }

  async execute({
    userId,
    id,
    remove,
  }: GetOrDeleteTransactionDto): Promise<TransactionResponseDto> {
    if (!id || !userId) {
      throw new AppError('Transaction ID and User ID are required for deletion', 400);
    }

    const current = await this.transactionRepository.findLatestByOriginalId(id, userId, !!remove);

    if (!current) {
      throw new AppError('Transaction not found', 404);
    }

    // Only reverse wallet balance if the transaction hasn't already been soft-deleted.
    // A prior soft-delete already reversed it; reversing again would double-corrupt the balance.
    if (current.wallet?.id && !current.deletedAt) {
      const delta = -WalletSnapshotService.signedAmount(current.total, current.type);
      await this.walletSnapshotService.applyTransactionDelta(
        current.wallet.id,
        userId,
        delta,
        current.id,
        current.date,
      );
    }

    const allVersions = await this.transactionRepository.findAllVersions(id, userId);
    const invoiceId = current.invoice?.id ?? null;

    let response: TransactionResponseDto;
    if (remove) {
      await this.transactionRepository.remove(allVersions);
      response = this.transactionRepository.formatResponse(allVersions[0]);
    } else {
      const softDeleted = await this.transactionRepository.softRemove(allVersions);
      response = this.transactionRepository.formatResponse(softDeleted[0]);
    }

    if (invoiceId) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
      if (invoice) {
        const remaining = await this.transactionRepository.find({
          where: { invoice: { id: invoiceId } },
        });
        const paidAmount = remaining.reduce((sum, t) => sum + Number(t.total), 0);
        await this.invoiceRepository.applyTransactionChange(invoice, paidAmount, 'transaction_removed');
      }
    }

    return response;
  }
}
