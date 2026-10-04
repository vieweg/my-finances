import { DataSource, EntityManager, IsNull, Like, Not, Repository } from 'typeorm';
import { Tag } from '../models/tags.model';
import { ListTagDto, TagResponseDto, TagUsageDto, TagWithUsageResponseDto } from '../dtos';
import { PAGINATION_TAGS } from '../../../constants';

// Every join table that links an entity to tags
const TAG_LINKS = [
  { usageKey: 'transactions', joinTable: 'transactions_tags', ownerColumn: 'transaction_id', ownerTable: 'transactions' },
  { usageKey: 'invoices', joinTable: 'invoice_tags', ownerColumn: 'invoice_id', ownerTable: 'invoices' },
  { usageKey: 'contracts', joinTable: 'contract_tags', ownerColumn: 'contract_id', ownerTable: 'contracts' },
] as const;

export default class TagRepository extends Repository<Tag> {
  constructor(dataSource: DataSource) {
    super(Tag, dataSource.createEntityManager());
  }

  // Key used to detect duplicates: ignores accents, case and extra whitespace
  static normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  // Counts how many active (non-deleted) transactions, invoices and contracts use each tag
  async countUsage(tagIds: string[]): Promise<Map<string, TagUsageDto>> {
    const usage = new Map<string, TagUsageDto>(
      tagIds.map((id) => [id, { transactions: 0, invoices: 0, contracts: 0 }]),
    );
    if (!tagIds.length) return usage;

    const placeholders = tagIds.map(() => '?').join(', ');
    await Promise.all(
      TAG_LINKS.map(async (link) => {
        const rows: Array<{ tagId: string; total: string }> = await this.query(
          `SELECT jt.tag_id AS tagId, COUNT(*) AS total
           FROM ${link.joinTable} jt
           INNER JOIN ${link.ownerTable} o ON o.id = jt.${link.ownerColumn}
           WHERE jt.tag_id IN (${placeholders}) AND o.deletedAt IS NULL
           GROUP BY jt.tag_id`,
          tagIds,
        );
        for (const row of rows) usage.get(row.tagId)![link.usageKey] = Number(row.total);
      }),
    );

    return usage;
  }

  // Moves every link from the source tags to the target tag. Rows of soft-deleted records
  // (e.g. old transaction versions) are moved too, so history keeps pointing at a live tag.
  async reassignLinks(manager: EntityManager, targetId: string, sourceIds: string[]): Promise<void> {
    const placeholders = sourceIds.map(() => '?').join(', ');
    for (const { joinTable, ownerColumn, ownerTable } of TAG_LINKS) {
      // Touch the affected records so their updatedAt reflects the tag change
      await manager.query(
        `UPDATE ${ownerTable} SET updatedAt = CURRENT_TIMESTAMP(6)
         WHERE id IN (SELECT ${ownerColumn} FROM ${joinTable} WHERE tag_id IN (${placeholders}))`,
        sourceIds,
      );
      await manager.query(
        `INSERT INTO ${joinTable} (${ownerColumn}, tag_id)
         SELECT DISTINCT s.${ownerColumn}, ?
         FROM ${joinTable} s
         WHERE s.tag_id IN (${placeholders})
           AND NOT EXISTS (SELECT 1 FROM ${joinTable} t WHERE t.${ownerColumn} = s.${ownerColumn} AND t.tag_id = ?)`,
        [targetId, ...sourceIds, targetId],
      );
      await manager.query(`DELETE FROM ${joinTable} WHERE tag_id IN (${placeholders})`, sourceIds);
    }
  }

  formatWithUsage(tag: Tag, usage?: TagUsageDto): TagWithUsageResponseDto {
    return {
      ...this.formatResponse(tag),
      usage: usage ?? { transactions: 0, invoices: 0, contracts: 0 },
    };
  }

  async findById(id: string, userId: string, withDeleted = false): Promise<Tag | null> {
    if (!id || !userId) return null;
    return this.findOne({ where: { id, user: { id: userId } }, withDeleted });
  }

  async findOneByTag(name: string, userId: string): Promise<Tag | null> {
    if (!name || !userId) return null;
    return this.findOne({ where: { name, user: { id: userId } } });
  }

  async findSoftDeletedByTag(name: string, userId: string): Promise<Tag | null> {
    if (!name || !userId) return null;
    return this.findOne({
      where: { name, user: { id: userId } },
      withDeleted: true,
    });
  }

  // Finds an active tag by id or name; if found soft-deleted by name, restores it.
  // Creates a new unsaved tag entity if nothing is found.
  async findOneOrCreate(
    { name, id }: { name?: string; id?: string },
    userId: string,
  ): Promise<Tag> {
    if (!userId) throw new Error('UserId is required');
    if (!name && !id) throw new Error('Name or ID is required to find or create a tag');

    if (id) {
      const tag = await this.findById(id, userId);
      if (tag) return tag;
    }

    if (name) {
      const active = await this.findOneByTag(name, userId);
      if (active) return active;

      // Tag was previously soft-deleted — restore it so the FK in transactions_tags stays valid
      const softDeleted = await this.findSoftDeletedByTag(name, userId);
      if (softDeleted) {
        softDeleted.deletedAt = null as unknown as Date;
        return softDeleted;
      }
    }

    return this.create({ name, user: { id: userId } });
  }

  async findAll(params: ListTagDto): Promise<[Tag[], number]> {
    const {
      userId,
      page = PAGINATION_TAGS.DEFAULT_PAGE,
      limit = PAGINATION_TAGS.DEFAULT_LIMIT,
      sortBy = PAGINATION_TAGS.SORT_BY[0],
      sortOrder = PAGINATION_TAGS.SORT_ORDER[0],
      search,
      deleted,
    } = params;

    return this.findAndCount({
      where: {
        user: { id: userId },
        ...(search && { name: Like(`%${search}%`) }),
        ...(deleted && { deletedAt: Not(IsNull()) }),
      },
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      withDeleted: !!deleted,
    });
  }

  formatResponse(data: Tag): TagResponseDto;
  formatResponse(data: Tag[]): TagResponseDto[];
  formatResponse(data: Tag | Tag[]): TagResponseDto | TagResponseDto[] {
    const fmt = (tag: Tag): TagResponseDto => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      ...(tag.deletedAt && { deletedAt: tag.deletedAt }),
    });

    return Array.isArray(data) ? data.map(fmt) : fmt(data);
  }
}
