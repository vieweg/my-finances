import { IsNull } from 'typeorm';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { InvoiceQueryDto, InvoiceResponseDto } from '../dtos';

export default class GetInvoiceService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: InvoiceQueryDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(dto.id, dto.userId, dto.deleted);
    if (!invoice) throw new AppError('Invoice not found', 404);

    // A soft-deleted invoice would be filtered out of the join, hiding its payments;
    // in that case include deleted rows in the join but still exclude deleted transactions.
    const transactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id }, deletedAt: IsNull() },
      relations: ['invoice', 'wallet'],
      order: { createdAt: 'ASC' },
      withDeleted: !!invoice.deletedAt,
    });

    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    const summaries = await this.invoiceRepository.formatTransactionSummaries(transactions);

    return this.invoiceRepository.formatResponse(invoice, paidAmount, summaries);
  }
}
