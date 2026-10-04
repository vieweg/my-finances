import { In } from 'typeorm';
import { dataSource } from '../../../database';
import Repository from '../repositories/tag.repository';
import { Tag } from '../models/tags.model';
import { MergeTagsDto, MergeTagsResponseDto } from '../dtos';
import AppError from '../../../errors/AppError';

export default class MergeService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  // Moves every transaction, invoice and contract link from the source tags to the target
  // tag, then soft-deletes the sources. Runs in a single DB transaction.
  async execute({ userId, targetId, sourceIds }: MergeTagsDto): Promise<MergeTagsResponseDto> {
    if (sourceIds.includes(targetId)) {
      throw new AppError('Target tag cannot also be a source tag', 400);
    }

    const tags = await this.repository.find({
      where: { id: In([targetId, ...sourceIds]), user: { id: userId } },
    });

    const target = tags.find((t) => t.id === targetId);
    if (!target) throw new AppError('Target tag not found', 404);

    const sources = tags.filter((t) => sourceIds.includes(t.id));
    if (sources.length !== sourceIds.length) throw new AppError('Source tag not found', 404);

    await dataSource.transaction(async (manager) => {
      await this.repository.reassignLinks(manager, targetId, sourceIds);
      await manager.softRemove(Tag, sources);
    });

    const usage = await this.repository.countUsage([targetId]);
    return {
      tag: this.repository.formatWithUsage(target, usage.get(targetId)),
      mergedIds: sourceIds,
    };
  }
}
