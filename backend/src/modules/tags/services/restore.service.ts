import { dataSource } from '../../../database';
import Repository from '../repositories/tag.repository';
import { GetOrDeleteTagDto, TagResponseDto } from '../dtos';
import AppError from '../../../errors/AppError';

export default class RestoreService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  async execute({ id, userId }: GetOrDeleteTagDto): Promise<TagResponseDto> {
    const tag = await this.repository.findOne({
      where: { id, user: { id: userId } },
      withDeleted: true,
    });
    if (!tag) throw new AppError('Tag not found', 404);
    if (!tag.deletedAt) throw new AppError('Tag is not deleted', 400);

    // Keep names unique among active tags (e.g. the tag was merged into one with the same name)
    const active = await this.repository.findOneByTag(tag.name, userId);
    if (active) throw new AppError('Tag already exists', 400);

    tag.deletedAt = null as unknown as Date;
    await this.repository.save(tag);

    return this.repository.formatResponse(tag);
  }
}
