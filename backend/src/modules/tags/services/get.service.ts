import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import Repository from '../repositories/tag.repository';
import { GetOrDeleteTagDto, TagResponseDto } from '../dtos';

export default class GetService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  async execute({ id, userId, deleted }: GetOrDeleteTagDto): Promise<TagResponseDto> {
    if (!id || !userId) {
      throw new AppError('User ID and Tag ID are required', 400);
    }
    const data = await this.repository.findById(id, userId, deleted);

    if (!data) {
      throw new AppError('Tag not found', 404);
    }

    return this.repository.formatResponse(data);
  }
}
