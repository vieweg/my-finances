import { dataSource } from '../../../database';
import Repository from '../repositories/tag.repository';
import { Tag } from '../models/tags.model';
import { ListTagDuplicatesDto, TagDuplicateGroupDto, TagUsageDto } from '../dtos';

const totalUsage = (u: TagUsageDto) => u.transactions + u.invoices + u.contracts;

export default class DuplicatesService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  // Groups the user's active tags whose names only differ by accents, case or whitespace.
  // Within a group, the most used tag comes first and is the suggested merge target.
  async execute({ userId }: ListTagDuplicatesDto): Promise<TagDuplicateGroupDto[]> {
    const tags = await this.repository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });

    const groups = new Map<string, Tag[]>();
    for (const tag of tags) {
      const key = Repository.normalizeName(tag.name);
      groups.set(key, [...(groups.get(key) ?? []), tag]);
    }

    const duplicates = [...groups.entries()].filter(([, group]) => group.length > 1);
    const usage = await this.repository.countUsage(duplicates.flatMap(([, group]) => group.map((t) => t.id)));

    return duplicates
      .map(([key, group]) => ({
        key,
        tags: group
          .map((tag) => this.repository.formatWithUsage(tag, usage.get(tag.id)))
          // stable sort keeps the oldest tag first on ties
          .sort((a, b) => totalUsage(b.usage) - totalUsage(a.usage)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }
}
