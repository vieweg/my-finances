import { DataSource, Repository } from 'typeorm';
import { Contract } from '../models/contract.model';
import { ContractResponseDto, ContractInvoiceSummaryDto, ContractTotalsDto, ListContractsDto } from '../dtos';
import { PAGINATION_CONTRACTS } from '../../../constants';
import WalletRepository, { formatWalletSummary } from '../../wallets/repositories/wallet.repository';

export default class ContractRepository extends Repository<Contract> {
  private walletRepository: WalletRepository;

  constructor(dataSource: DataSource) {
    super(Contract, dataSource.createEntityManager());
    this.walletRepository = new WalletRepository(dataSource);
  }

  // Loads soft-deleted wallets so responses can still show them
  async withDeletedWallets(contracts: Contract[]): Promise<Contract[]> {
    return this.walletRepository.fillDeleted(contracts);
  }

  async findById(id: string, userId: string, withDeleted = false): Promise<Contract | null> {
    if (!id) return null;
    const contract = await this.findOne({ where: { id, user: { id: userId } }, withDeleted });
    if (contract) await this.withDeletedWallets([contract]);
    return contract;
  }

  async findAll(params: ListContractsDto): Promise<[Contract[], number]> {
    const {
      userId,
      page = PAGINATION_CONTRACTS.DEFAULT_PAGE,
      limit = PAGINATION_CONTRACTS.DEFAULT_LIMIT,
      sortBy = PAGINATION_CONTRACTS.DEFAULT_SORT_BY,
      sortOrder = PAGINATION_CONTRACTS.SORT_ORDER[0],
      filterByStatus,
      filterByType,
      filterByContactId,
      filterByContactName,
      filterByCurrency,
      name,
      description,
      search,
      deleted,
      includeCompleted,
    } = params;

    const dir = sortOrder.toUpperCase() as 'ASC' | 'DESC';

    const qb = this.createQueryBuilder('c')
      .innerJoinAndSelect('c.contact', 'contact')
      .leftJoinAndSelect('c.wallet', 'wallet')
      .leftJoinAndSelect('c.tags', 'tag')
      .innerJoin('c.user', 'user')
      .where('user.id = :userId', { userId })
      .skip((page - 1) * limit)
      .take(limit);

    if (sortBy === 'amount') {
      // Signed like the UI shows it: receivables positive, payables negative
      qb.addSelect(`CASE WHEN c.type = 'payable' THEN -c.amount ELSE c.amount END`, 'signed_amount').orderBy(
        'signed_amount',
        dir,
      );
    } else {
      qb.orderBy(`c.${sortBy}`, dir);
    }
    qb.addOrderBy('c.createdAt', dir);

    if (deleted) qb.withDeleted().andWhere('c.deletedAt IS NOT NULL');

    // Without an explicit status, list active contracts (plus completed ones on request).
    // Deleted contracts are always cancelled, so the default doesn't apply to them.
    if (filterByStatus) qb.andWhere('c.status = :filterByStatus', { filterByStatus });
    else if (!deleted)
      qb.andWhere('c.status IN (:...statuses)', { statuses: includeCompleted ? ['active', 'completed'] : ['active'] });
    if (filterByType) qb.andWhere('c.type = :filterByType', { filterByType });
    if (filterByContactId) qb.andWhere('contact.id = :filterByContactId', { filterByContactId });
    if (filterByContactName)
      qb.andWhere('contact.name LIKE :filterByContactName', { filterByContactName: `%${filterByContactName}%` });
    if (filterByCurrency) qb.andWhere('c.currency = :filterByCurrency', { filterByCurrency });
    if (name) qb.andWhere('c.name LIKE :name', { name: `%${name}%` });
    if (description) qb.andWhere('c.description LIKE :description', { description: `%${description}%` });
    if (search)
      qb.andWhere('(c.description LIKE :search OR c.notes LIKE :search OR contact.name LIKE :search)', {
        search: `%${search}%`,
      });

    const [contracts, total] = await qb.getManyAndCount();
    return [await this.withDeletedWallets(contracts), total];
  }

  formatResponse(
    contract: Contract,
    invoices?: ContractInvoiceSummaryDto[],
    totals?: ContractTotalsDto,
  ): ContractResponseDto {
    return {
      id: contract.id,
      name: contract.name,
      type: contract.type,
      status: contract.status,
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
      total: { amount: Number(contract.amount), currency: contract.currency },
      description: contract.description,
      notes: contract.notes ?? null,
      tags: (contract.tags ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      instalments: contract.instalments,
      instalmentsDone: contract.instalmentsDone,
      cycleMonths: contract.cycleMonths,
      firstDueDate: contract.firstDueDate,
      nextDueDate: contract.nextDueDate,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      ...(contract.deletedAt && { deletedAt: contract.deletedAt }),
      ...(invoices !== undefined && { invoices }),
      ...totals,
    };
  }
}
