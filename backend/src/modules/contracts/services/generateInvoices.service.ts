import { addMonths } from 'date-fns';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContractRepository from '../repositories/contract.repository';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import { Contract } from '../models/contract.model';
import { renderDescription } from '../../../utils/descriptionTemplate';

export default class GenerateContractInvoicesService {
  private contractRepository: ContractRepository;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
    this.invoiceRepository = new InvoiceRepository(dataSource);
  }

  async execute(contractId?: string, userId?: string): Promise<{ generated: number }> {
    if (contractId && userId) {
      return this.executeForOne(contractId, userId);
    }
    return this.executeForAll();
  }

  private async executeForAll(): Promise<{ generated: number }> {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const contracts = await this.contractRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.contact', 'contact')
      .leftJoinAndSelect('c.wallet', 'wallet')
      .leftJoinAndSelect('c.tags', 'tag')
      .innerJoinAndSelect('c.user', 'user')
      .where('c.status = :status', { status: 'active' })
      .andWhere('c.nextDueDate <= :threshold', { threshold: sevenDaysFromNow })
      .andWhere('c.deletedAt IS NULL')
      .getMany();

    let generated = 0;
    for (const contract of contracts) {
      try {
        const created = await this.generateOne(contract);
        if (created) generated++;
      } catch (err) {
        console.error(`[GenerateContractInvoices] Failed for contract ${contract.id}:`, err);
      }
    }
    return { generated };
  }

  private async executeForOne(contractId: string, userId: string): Promise<{ generated: number }> {
    const contract = await this.contractRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.contact', 'contact')
      .leftJoinAndSelect('c.wallet', 'wallet')
      .leftJoinAndSelect('c.tags', 'tag')
      .innerJoinAndSelect('c.user', 'user')
      .where('c.id = :contractId', { contractId })
      .andWhere('user.id = :userId', { userId })
      .withDeleted()
      .getOne();

    if (!contract) throw new AppError('Contract not found', 404);
    if (contract.status !== 'active' || contract.deletedAt) throw new AppError('Contract is not active', 400);

    const created = await this.generateOne(contract);
    return { generated: created ? 1 : 0 };
  }

  // Returns true if a new invoice was created, false if one already existed for nextDueDate.
  // Matches by calendar month rather than exact date because addMonths can drift the day when
  // months have different lengths (e.g. May 31 → June 30), so imported invoices may land on
  // a different day than our computed nextDueDate.
  async generateOne(contract: Contract): Promise<boolean> {
    const now = new Date();
    const dueDate = new Date(contract.nextDueDate);

    const monthStart = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 1));

    const existing = await this.invoiceRepository
      .createQueryBuilder('inv')
      .where('inv.contractId = :contractId', { contractId: contract.id })
      .andWhere('inv.dueDate >= :start', { start: monthStart })
      .andWhere('inv.dueDate < :end', { end: monthEnd })
      .andWhere('inv.deletedAt IS NULL')
      .getOne();

    if (!existing) {
      const invoice = this.invoiceRepository.create({
        user: contract.user,
        contact: contract.contact,
        wallet: contract.wallet ?? null,
        contract,
        type: contract.type,
        status: 'pending',
        amount: contract.amount,
        currency: contract.currency,
        issueDate: now,
        dueDate,
        description: contract.description
          ? renderDescription(contract.description, {
              contactName: contract.contact.name,
              instalmentNumber: contract.instalmentsDone + 1,
              totalInstalments: contract.instalments,
              dueDate,
              cycleMonths: contract.cycleMonths,
              amount: Number(contract.amount),
              currency: contract.currency,
            })
          : null,
        tags: contract.tags ?? [],
        history: [{ event: 'created', at: now.toISOString(), status: 'pending' }],
      });
      await this.invoiceRepository.save(invoice);
    }

    contract.instalmentsDone += 1;
    contract.nextDueDate = addMonths(contract.nextDueDate, contract.cycleMonths);

    if (contract.instalments > 0 && contract.instalmentsDone >= contract.instalments) {
      contract.status = 'completed';
    }

    await this.contractRepository.save(contract);
    return !existing;
  }
}
