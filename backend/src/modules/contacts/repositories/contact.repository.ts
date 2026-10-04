import { DataSource, Repository } from 'typeorm';
import { Contact } from '../models/contact.model';
import { ContactResponseDto, ListContactsDto } from '../dtos';
import { PAGINATION_CONTACTS } from '../../../constants';

export default class ContactRepository extends Repository<Contact> {
  constructor(dataSource: DataSource) {
    super(Contact, dataSource.createEntityManager());
  }

  async findAll(dto: ListContactsDto): Promise<[Contact[], number]> {
    const {
      userId,
      deleted,
      name,
      email,
      sortBy = PAGINATION_CONTACTS.DEFAULT_SORT_BY,
      sortOrder = PAGINATION_CONTACTS.SORT_ORDER[0],
      page = PAGINATION_CONTACTS.DEFAULT_PAGE,
      limit = PAGINATION_CONTACTS.DEFAULT_LIMIT,
    } = dto;
    const direction = sortOrder.toUpperCase() as 'ASC' | 'DESC';

    const qb = this.createQueryBuilder('c')
      .innerJoin('c.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy(`c.${sortBy}`, direction)
      .skip((page - 1) * limit)
      .take(limit);

    if (sortBy !== 'createdAt') qb.addOrderBy('c.createdAt', direction);

    if (name) qb.andWhere('c.name LIKE :name', { name: `%${name}%` });
    if (email) qb.andWhere('c.email LIKE :email', { email: `%${email}%` });

    if (deleted) {
      qb.withDeleted().andWhere('c.deletedAt IS NOT NULL');
    }

    return qb.getManyAndCount();
  }

  async findById(id: string, userId: string, withDeleted = false): Promise<Contact | null> {
    if (!id) return null;
    return this.findOne({ where: { id, user: { id: userId } }, withDeleted });
  }

  formatResponse(contact: Contact): ContactResponseDto;
  formatResponse(contact: Contact[]): ContactResponseDto[];
  formatResponse(contact: Contact | Contact[]): ContactResponseDto | ContactResponseDto[] {
    const format = (c: Contact): ContactResponseDto => ({
      id: c.id,
      name: c.name,
      document: c.document ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...(c.deletedAt && { deletedAt: c.deletedAt }),
    });

    if (Array.isArray(contact)) return contact.map(format);
    return format(contact);
  }
}
