import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { InvoiceQueryDto, InvoiceResponseDto } from '../dtos';

export default class RestoreInvoiceService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: InvoiceQueryDto): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      relations: ['contact', 'wallet', 'tags'],
      withDeleted: true,
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (!invoice.deletedAt) throw new AppError('Invoice is not deleted', 400);

    const transactions = await this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.wallet', 'wallet')
      .where('t.invoiceId = :invoiceId', { invoiceId: invoice.id })
      .andWhere('t.deletedAt IS NULL')
      .orderBy('t.createdAt', 'ASC')
      .getMany();
    const paidAmount = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    const newStatus =
      paidAmount >= Number(invoice.amount) ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

    invoice.status = newStatus;
    invoice.history = [
      ...invoice.history,
      {
        event: 'restored',
        at: new Date().toISOString(),
        status: newStatus,
        paidAmount,
        ...(dto.reason && { reason: dto.reason }),
      },
    ];
    invoice.deletedAt = null as unknown as Date;
    await this.invoiceRepository.save(invoice);

    const summaries = await this.invoiceRepository.formatTransactionSummaries(transactions);

    return this.invoiceRepository.formatResponse(invoice, paidAmount, summaries);
  }
}
