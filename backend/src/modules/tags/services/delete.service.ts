import { dataSource } from '../../../database';
import Repository from '../repositories/tag.repository';
import { GetOrDeleteTagDto, TagResponseDto } from '../dtos';
import AppError from '../../../errors/AppError';

export default class DeleteService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  async execute({ id, userId }: GetOrDeleteTagDto): Promise<TagResponseDto> {
    if (!id || !userId) {
      throw new AppError('Tag ID and User ID are required for deletion', 400);
    }

    const tag = await this.repository.findById(id, userId);

    if (!tag) {
      throw new AppError('Tag not found', 404);
    }

    const deleted = await this.repository.softRemove(tag);
    return this.repository.formatResponse(deleted);
  }
}
