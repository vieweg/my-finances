import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { MarkPaidDto, InvoiceResponseDto } from '../dtos';

export default class UnmarkPaidService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: MarkPaidDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(dto.id, dto.userId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status !== 'paid') throw new AppError('Invoice is not paid', 400);

    const transactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id } },
      relations: ['wallet'],
      order: { createdAt: 'ASC' },
    });
    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    if (paidAmount >= Number(invoice.amount)) {
      throw new AppError(
        'Invoice is fully covered by transactions; remove a transaction or increase the invoice amount to change its status',
        400,
      );
    }

    await this.invoiceRepository.applyTransactionChange(invoice, paidAmount, 'mark_unpaid');

    const summaries = await this.invoiceRepository.formatTransactionSummaries(transactions);

    return this.invoiceRepository.formatResponse(invoice, paidAmount, summaries);
  }
}
