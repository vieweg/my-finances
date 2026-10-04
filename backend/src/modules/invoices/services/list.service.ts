import { In } from 'typeorm';
import { addMonths } from 'date-fns';
import { dataSource } from '../../../database';
import InvoiceRepository from '../repositories/invoice.repository';
import TransactionRepository from '../../transactions/repositories/transaction.repository';
import ContractRepository from '../../contracts/repositories/contract.repository';
import { formatWalletSummary } from '../../wallets/repositories/wallet.repository';
import { ListInvoicesDto, InvoiceResponseDto, ProjectedInvoiceDto } from '../dtos';
import { renderDescription } from '../../../utils/descriptionTemplate';
import { PAGINATION_INVOICES } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

type ListedInvoice = InvoiceResponseDto | ProjectedInvoiceDto;

// Mirrors the SQL ordering of InvoiceRepository.findAll for lists built in memory:
// nulls first on ascending (as in MySQL), case-insensitive text, then dueDate as tie-breaker.
const sortValue = (inv: ListedInvoice, sortBy: string): string | number | null => {
  const time = (d?: Date | null) => (d ? new Date(d).getTime() : null);
  const sign = inv.type === 'payable' ? -1 : 1;
  switch (sortBy) {
    case 'amount':
      return sign * inv.total.amount;
    case 'outstanding':
      return sign * (inv.total.amount - inv.paidAmount.amount);
    case 'contact':
      return inv.contact.name;
    case 'dueDate':
    case 'issueDate':
      return time(inv[sortBy]);
    case 'createdAt':
    case 'updatedAt':
      return 'id' in inv ? time(inv[sortBy]) : null;
    case 'currency':
      return inv.total.currency;
    case 'status':
    case 'type':
      return inv[sortBy];
    case 'description':
      return inv.description;
    default:
      return null;
  }
};

const compareValues = (a: string | number | null, b: string | number | null): number => {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
};

const sortInvoices = (items: ListedInvoice[], sortBy: string, sortOrder: string): ListedInvoice[] => {
  const dir = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
  return [...items].sort(
    (a, b) =>
      dir * compareValues(sortValue(a, sortBy), sortValue(b, sortBy)) ||
      compareValues(sortValue(a, 'dueDate'), sortValue(b, 'dueDate')),
  );
};

export default class ListInvoicesService {
  private invoiceRepository: InvoiceRepository;
  private transactionRepository: TransactionRepository;
  private contractRepository: ContractRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository(dataSource);
    this.transactionRepository = new TransactionRepository(dataSource);
    this.contractRepository = new ContractRepository(dataSource);
  }

  async execute(dto: ListInvoicesDto): Promise<PaginatedResponseDto<ListedInvoice>> {
    const page = dto.page ?? PAGINATION_INVOICES.DEFAULT_PAGE;
    const limit = dto.limit ?? PAGINATION_INVOICES.DEFAULT_LIMIT;

    // Forecast merges real and projected invoices, so sorting and pagination happen after the merge
    const [invoices, total] = await this.invoiceRepository.findAll(dto, !dto.forecast);

    const paidMap = new Map<string, number>();

    if (invoices.length) {
      const ids = invoices.map((i) => i.id);

      if (dto.deleted) {
        const placeholders = ids.map(() => '?').join(', ');
        const rawRows: Array<{ invoiceId: string; total: string }> = await this.transactionRepository.query(
          `SELECT invoiceId, total FROM transactions WHERE invoiceId IN (${placeholders}) AND deletedAt IS NULL`,
          ids,
        );
        for (const row of rawRows) {
          const current = paidMap.get(row.invoiceId) ?? 0;
          paidMap.set(row.invoiceId, current + Number(row.total));
        }
      } else {
        const transactions = await this.transactionRepository.find({
          where: { invoice: { id: In(ids) } },
          relations: ['invoice'],
          withDeleted: false,
        });
        for (const t of transactions) {
          const invoiceId = t.invoice?.id;
          if (!invoiceId) continue;
          const current = paidMap.get(invoiceId) ?? 0;
          paidMap.set(invoiceId, current + Number(t.total));
        }
      }
    }

    if (!dto.forecast) {
      return paginate(
        invoices.map((invoice) => this.invoiceRepository.formatResponse(invoice, paidMap.get(invoice.id) ?? 0)),
        total,
        page,
        limit,
      );
    }

    const realItems: InvoiceResponseDto[] = invoices.map((invoice) => ({
      ...this.invoiceRepository.formatResponse(invoice, paidMap.get(invoice.id) ?? 0),
      projected: false,
    }));

    const projected = await this.projectFromContracts(dto);

    const merged = sortInvoices(
      [...realItems, ...projected],
      dto.sortBy ?? PAGINATION_INVOICES.DEFAULT_SORT_BY,
      dto.sortOrder ?? PAGINATION_INVOICES.SORT_ORDER[0],
    );
    return paginate(merged.slice((page - 1) * limit, page * limit), merged.length, page, limit);
  }

  private async projectFromContracts(dto: ListInvoicesDto): Promise<ProjectedInvoiceDto[]> {
    const { userId, filterByType, filterByCurrency, filterByContactId, filterByContactName, search, filterByDateRange, description } = dto;
    const startDate = filterByDateRange!.startDate!;
    const endDate = filterByDateRange?.endDate
      ? new Date(new Date(filterByDateRange.endDate).setUTCHours(23, 59, 59, 999))
      : new Date(8640000000000000); // max date — no upper bound

    const contracts = await this.contractRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.contact', 'contact')
      .leftJoinAndSelect('c.wallet', 'wallet')
      .leftJoinAndSelect('c.tags', 'tag')
      .innerJoin('c.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('c.status = :status', { status: 'active' })
      .andWhere('c.deletedAt IS NULL')
      .getMany();

    if (!contracts.length) return [];
    await this.contractRepository.withDeletedWallets(contracts);

    // Build a de-dup set of "contractId:YYYY-MM-DD" for invoices that already exist in the DB
    // within the date range. This handles cases where nextDueDate wasn't advanced after generation
    // (e.g. data imported from an external system).
    const contractIds = contracts.map((c) => c.id);
    const existingRows: Array<{ contractId: string; dueDate: string }> = await this.invoiceRepository.query(
      `SELECT contractId, dueDate FROM invoices WHERE contractId IN (${contractIds.map(() => '?').join(',')}) AND deletedAt IS NULL`,
      contractIds,
    );
    // Key by YYYY-MM (not YYYY-MM-DD): addMonths can drift the day when months have different
    // lengths (e.g. May 31 → June 30 → July 30), so the projected date may differ by a day from
    // an invoice generated/imported by a system that preserved end-of-month semantics.
    const existingKeys = new Set<string>(
      existingRows.map((r) => `${r.contractId}:${new Date(r.dueDate).toISOString().slice(0, 7)}`),
    );

    const result: ProjectedInvoiceDto[] = [];

    for (const contract of contracts) {
      if (filterByType && contract.type !== filterByType) continue;
      if (filterByCurrency && contract.currency !== filterByCurrency) continue;
      if (filterByContactId && contract.contact.id !== filterByContactId) continue;
      if (filterByContactName && !contract.contact.name.toLowerCase().includes(filterByContactName.toLowerCase())) continue;

      let remaining: number =
        contract.instalments > 0 ? contract.instalments - contract.instalmentsDone : Infinity;

      let currentDate = new Date(contract.nextDueDate);
      let instalmentNumber = contract.instalmentsDone;

      while (currentDate <= endDate && remaining > 0) {
        instalmentNumber++;
        const monthKey = `${contract.id}:${currentDate.toISOString().slice(0, 7)}`;
        if (existingKeys.has(monthKey)) {
          // Real invoice exists for this month but instalmentsDone may not reflect it (e.g. crash
          // between invoice save and contract save). Count it against remaining so projection
          // doesn't overflow past the contract end.
          remaining--;
          currentDate = addMonths(currentDate, contract.cycleMonths);
          continue;
        }

        if (currentDate >= startDate) {
          const renderedDescription = contract.description
            ? renderDescription(contract.description, {
                contactName: contract.contact.name,
                instalmentNumber,
                totalInstalments: contract.instalments,
                dueDate: currentDate,
                cycleMonths: contract.cycleMonths,
                amount: Number(contract.amount),
                currency: contract.currency,
              })
            : null;

          const descMatch = !description || (renderedDescription?.toLowerCase().includes(description.toLowerCase()) ?? false);
          const searchMatch = !search || (renderedDescription?.toLowerCase().includes(search.toLowerCase()) ?? false) || contract.contact.name.toLowerCase().includes(search.toLowerCase());
          if (descMatch && searchMatch) {
            result.push({
              projected: true,
              contractId: contract.id,
              contact: {
                id: contract.contact.id,
                name: contract.contact.name,
                document: contract.contact.document ?? null,
                email: contract.contact.email ?? null,
                phone: contract.contact.phone ?? null,
                notes: contract.contact.notes ?? null,
                createdAt: contract.contact.createdAt,
                updatedAt: contract.contact.updatedAt,
              },
              walletId: contract.wallet?.id ?? null,
              wallet: formatWalletSummary(contract.wallet),
              type: contract.type as 'payable' | 'receivable',
              total: { amount: Number(contract.amount), currency: contract.currency },
              paidAmount: { amount: 0, currency: contract.currency },
              status: 'projected',
              isOverdue: false,
              dueDate: new Date(currentDate),
              issueDate: null,
              description: renderedDescription,
              tags: (contract.tags ?? []).map((t) => ({
                id: t.id,
                name: t.name,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
              })),
              history: [],
            });
          }
        }
        remaining--;
        currentDate = addMonths(currentDate, contract.cycleMonths);
      }
    }

    return result;
  }
}
