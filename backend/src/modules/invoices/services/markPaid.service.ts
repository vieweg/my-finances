import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { MarkPaidDto, InvoiceResponseDto } from '../dtos';

export default class MarkPaidService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: MarkPaidDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(dto.id, dto.userId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'cancelled') throw new AppError('Cannot mark a cancelled invoice as paid', 400);
    if (invoice.status === 'paid') throw new AppError('Invoice is already paid', 400);

    const transactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id } },
    });
    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    invoice.status = 'paid';
    invoice.history = [
      ...invoice.history,
      { event: 'mark_paid', at: new Date().toISOString(), status: 'paid', paidAmount },
    ];
    await this.invoiceRepository.save(invoice);

    return this.invoiceRepository.formatResponse(invoice, paidAmount);
  }
}
