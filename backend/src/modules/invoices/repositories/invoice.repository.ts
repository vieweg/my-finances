import { DataSource, Repository } from 'typeorm';
import { Invoice } from '../models/invoice.model';
import { InvoiceResponseDto, ListInvoicesDto, TransactionSummaryDto } from '../dtos';
import { PAGINATION_INVOICES } from '../../../constants';
import { Transaction } from '../../transactions/models/transactions.model';
import WalletRepository, { formatWalletSummary } from '../../wallets/repositories/wallet.repository';

export default class InvoiceRepository extends Repository<Invoice> {
  private walletRepository: WalletRepository;

  constructor(dataSource: DataSource) {
    super(Invoice, dataSource.createEntityManager());
    this.walletRepository = new WalletRepository(dataSource);
  }

  // paginate = false returns every matching invoice (used by forecast, which paginates after merging projections)
  async findAll(params: ListInvoicesDto, paginate = true): Promise<[Invoice[], number]> {
    const {
      userId,
      page = PAGINATION_INVOICES.DEFAULT_PAGE,
      limit = PAGINATION_INVOICES.DEFAULT_LIMIT,
      sortBy = PAGINATION_INVOICES.DEFAULT_SORT_BY,
      sortOrder = PAGINATION_INVOICES.SORT_ORDER[0],
      filterByType,
      filterByStatus,
      filterByIsOverdue,
      filterByCurrency,
      filterByContactId,
      filterByContactName,
      search,
      filterByDateRange,
      description,
      filterByTag,
      filterByTagId,
    } = params;

    const dir = sortOrder.toUpperCase() as 'ASC' | 'DESC';

    const qb = this.createQueryBuilder('i')
      .innerJoinAndSelect('i.contact', 'contact')
      .leftJoinAndSelect('i.wallet', 'wallet')
      .leftJoinAndSelect('i.tags', 'tag')
      .leftJoinAndSelect('i.contract', 'contract')
      .innerJoin('i.user', 'user')
      .where('user.id = :userId', { userId });

    if (paginate) qb.skip((page - 1) * limit).take(limit);

    // Amount and outstanding are signed like the UI shows them: receivables positive, payables negative
    const sign = `(CASE WHEN i.type = 'payable' THEN -1 ELSE 1 END)`;
    if (sortBy === 'outstanding') {
      qb.addSelect(
        `${sign} * (i.amount - COALESCE((SELECT SUM(t.total) FROM transactions t WHERE t.invoiceId = i.id AND t.deletedAt IS NULL), 0))`,
        'outstanding_val',
      ).orderBy('outstanding_val', dir);
    } else if (sortBy === 'amount') {
      qb.addSelect(`${sign} * i.amount`, 'signed_amount').orderBy('signed_amount', dir);
    } else {
      const orderCol = sortBy === 'contact' ? 'contact.name' : `i.${sortBy}`;
      qb.orderBy(orderCol, dir);
    }

    if (params.deleted) {
      qb.withDeleted().andWhere('i.deletedAt IS NOT NULL');
    }

    if (sortBy !== 'createdAt') qb.addOrderBy('i.createdAt', dir);

    if (filterByType) qb.andWhere('i.type = :filterByType', { filterByType });
    if (filterByStatus) {
      const statuses = Array.isArray(filterByStatus) ? filterByStatus : [filterByStatus];
      qb.andWhere('i.status IN (:...filterByStatus)', { filterByStatus: statuses });
    }
    if (filterByCurrency) qb.andWhere('i.currency = :filterByCurrency', { filterByCurrency });
    if (filterByContactId) qb.andWhere('contact.id = :filterByContactId', { filterByContactId });
    if (filterByContactName)
      qb.andWhere('contact.name LIKE :filterByContactName', { filterByContactName: `%${filterByContactName}%` });
    if (search)
      qb.andWhere('(i.description LIKE :search OR i.notes LIKE :search OR contact.name LIKE :search)', {
        search: `%${search}%`,
      });
    if (params.contractId) qb.andWhere('i.contractId = :contractId', { contractId: params.contractId });
    if (description)
      qb.andWhere('i.description LIKE :description', { description: `%${description}%` });

    if (filterByIsOverdue !== undefined) {
      if (filterByIsOverdue) {
        qb.andWhere("i.status IN ('pending', 'partial')").andWhere('i.dueDate < :now', {
          now: new Date(),
        });
      } else {
        qb.andWhere("(i.status NOT IN ('pending', 'partial') OR i.dueDate >= :now)", {
          now: new Date(),
        });
      }
    }

    const { startDate, endDate } = filterByDateRange || {};
    const endOfDay = endDate ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) : undefined;
    if (startDate && endOfDay) {
      qb.andWhere('i.dueDate BETWEEN :startDate AND :endDate', { startDate, endDate: endOfDay });
    } else if (startDate) {
      qb.andWhere('i.dueDate >= :startDate', { startDate });
    } else if (endOfDay) {
      qb.andWhere('i.dueDate <= :endDate', { endDate: endOfDay });
    }

    filterByTag?.forEach((term, idx) => {
      const param = `tagTerm${idx}`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM invoice_tags it INNER JOIN tags tg ON it.tag_id = tg.id WHERE it.invoice_id = i.id AND tg.name LIKE :${param} AND tg.deletedAt IS NULL)`,
        { [param]: `%${term}%` },
      );
    });

    filterByTagId?.forEach((tagId, idx) => {
      const param = `tagId${idx}`;
      qb.andWhere(`EXISTS (SELECT 1 FROM invoice_tags it WHERE it.invoice_id = i.id AND it.tag_id = :${param})`, {
        [param]: tagId,
      });
    });

    const [invoices, total] = await qb.getManyAndCount();
    return [await this.walletRepository.fillDeleted(invoices), total];
  }

  async findById(id: string, userId: string, withDeleted = false): Promise<Invoice | null> {
    if (!id) return null;
    const invoice = await this.findOne({ where: { id, user: { id: userId } }, relations: { contract: true }, withDeleted });
    if (invoice) await this.walletRepository.fillDeleted([invoice]);
    return invoice;
  }

  // Payments listed on an invoice
  async formatTransactionSummaries(transactions: Transaction[]): Promise<TransactionSummaryDto[]> {
    await this.walletRepository.fillDeleted(transactions);
    return transactions.map((t) => ({
      id: t.originalId ?? t.id,
      versionId: t.id,
      date: t.date,
      type: t.type,
      total: { amount: Number(t.total), currency: t.currency },
      description: t.description,
      notes: t.notes ?? null,
      tags: t.tags,
      walletId: t.wallet?.id ?? null,
      wallet: formatWalletSummary(t.wallet),
    }));
  }

  async applyTransactionChange(
    invoice: Invoice,
    paidAmount: number,
    event: 'transaction_added' | 'transaction_removed' | 'transaction_updated' | 'mark_unpaid',
    extra?: { transactionId: string; transactionAmount: number },
  ): Promise<void> {
    const newStatus =
      paidAmount >= Number(invoice.amount) ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
    invoice.status = newStatus;
    invoice.history = [
      ...invoice.history,
      { event, at: new Date().toISOString(), status: newStatus, paidAmount, ...extra },
    ];
    await this.save(invoice);
  }

formatResponse(
    invoice: Invoice,
    paidAmount: number,
    transactions?: TransactionSummaryDto[],
  ): InvoiceResponseDto {
    const isOverdue =
      (invoice.status === 'pending' || invoice.status === 'partial') &&
      new Date(invoice.dueDate) < new Date();

    return {
      id: invoice.id,
      type: invoice.type,
      status: invoice.status,
      isOverdue,
      contact: {
        id: invoice.contact.id,
        name: invoice.contact.name,
        document: invoice.contact.document ?? null,
        email: invoice.contact.email ?? null,
        phone: invoice.contact.phone ?? null,
        notes: invoice.contact.notes ?? null,
        createdAt: invoice.contact.createdAt,
        updatedAt: invoice.contact.updatedAt,
      },
      walletId: invoice.wallet?.id ?? null,
      wallet: formatWalletSummary(invoice.wallet),
      contractId: invoice.contract?.id ?? null,
      total: { amount: Number(invoice.amount), currency: invoice.currency },
      paidAmount: { amount: paidAmount, currency: invoice.currency },
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      description: invoice.description ?? null,
      notes: invoice.notes ?? null,
      tags: (invoice.tags ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
      history: invoice.history ?? [],
      ...(transactions !== undefined && { transactions }),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      ...(invoice.deletedAt && { deletedAt: invoice.deletedAt }),
    };
  }
}
