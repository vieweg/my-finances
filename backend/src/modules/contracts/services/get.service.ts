import { IsNull } from 'typeorm';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContractRepository from '../repositories/contract.repository';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import { ContractQueryDto, ContractResponseDto, ContractInvoiceSummaryDto, ContractTotalsDto } from '../dtos';

const round = (value: number) => Math.round(value * 100) / 100;

export default class GetContractService {
  private contractRepository: ContractRepository;
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
  }

  async execute(dto: ContractQueryDto): Promise<ContractResponseDto> {
    const contract = await this.contractRepository.findById(dto.id, dto.userId, dto.deleted);
    if (!contract) throw new AppError('Contract not found', 404);

    // A soft-deleted contract would be filtered out of the join, hiding its invoices;
    // in that case include deleted rows in the join but still exclude deleted invoices.
    const invoices = await this.invoiceRepository.find({
      where: { contract: { id: dto.id }, deletedAt: IsNull() },
      order: { dueDate: 'DESC' },
      withDeleted: !!contract.deletedAt,
    });

    const paidRows: Array<{ invoiceId: string; paid: string }> = invoices.length
      ? await this.transactionRepository
          .createQueryBuilder('t')
          .select('t.invoiceId', 'invoiceId')
          .addSelect('SUM(t.total)', 'paid')
          .where('t.invoiceId IN (:...ids)', { ids: invoices.map((inv) => inv.id) })
          .groupBy('t.invoiceId')
          .getRawMany()
      : [];
    const paidMap = new Map(paidRows.map((row) => [row.invoiceId, Number(row.paid)]));

    const invoiceSummaries: ContractInvoiceSummaryDto[] = invoices.map((inv) => {
      const amount = Number(inv.amount);
      const paid = paidMap.get(inv.id) ?? 0;
      // An invoice marked as paid owes nothing, even if its payments don't cover the amount
      const outstanding = inv.status === 'paid' ? 0 : Math.max(round(amount - paid), 0);
      return {
        id: inv.id,
        status: inv.status,
        dueDate: inv.dueDate,
        issueDate: inv.issueDate,
        total: { amount, currency: inv.currency },
        paidAmount: { amount: paid, currency: inv.currency },
        outstanding: { amount: outstanding, currency: inv.currency },
      };
    });

    // Totals are in the contract currency; invoices moved to another currency are left out
    const sameCurrency = invoiceSummaries.filter((inv) => inv.total.currency === contract.currency);
    const sum = (pick: (inv: ContractInvoiceSummaryDto) => number) =>
      ({ amount: round(sameCurrency.reduce((acc, inv) => acc + pick(inv), 0)), currency: contract.currency });
    const totals: ContractTotalsDto = {
      totalInvoiced: sum((inv) => inv.total.amount),
      totalPaid: sum((inv) => inv.paidAmount.amount),
      totalOutstanding: sum((inv) => inv.outstanding.amount),
    };

    return this.contractRepository.formatResponse(contract, invoiceSummaries, totals);
  }
}
