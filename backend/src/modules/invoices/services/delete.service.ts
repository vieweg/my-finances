import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { InvoiceQueryDto, InvoiceResponseDto } from '../dtos';

export default class DeleteInvoiceService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: InvoiceQueryDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const transactions = await this.transactionRepository.find({
      where: { invoice: { id: invoice.id } },
    });
    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    if (dto.remove) {
      return this.invoiceRepository.formatResponse(
        await this.invoiceRepository.remove(invoice),
        paidAmount,
      );
    }

    invoice.status = 'cancelled';
    invoice.history = [
      ...invoice.history,
      { event: 'cancelled', at: new Date().toISOString(), status: 'cancelled', ...(dto.reason && { reason: dto.reason }) },
    ];
    await this.invoiceRepository.save(invoice);

    return this.invoiceRepository.formatResponse(
      await this.invoiceRepository.softRemove(invoice),
      paidAmount,
    );
  }
}
