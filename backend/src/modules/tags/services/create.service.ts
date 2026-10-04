import { dataSource } from '../../../database';
import { AddTagDto, TagResponseDto } from '../dtos';
import Repository from '../repositories/tag.repository';
import UserRepository from '../../users/repositories/user.repository';
import AppError from '../../../errors/AppError';

export default class CreateService {
  private repository: Repository;
  private userRepository: UserRepository;

  constructor() {
    this.repository = new Repository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(dto: AddTagDto): Promise<TagResponseDto> {
    const user = await this.userRepository.findById(dto.userId);

    if (!user) {
      throw new AppError('User not found', 401);
    }

    const active = await this.repository.findOneByTag(dto.name, user.id);
    if (active) {
      throw new AppError('Tag already exists', 400);
    }

    // If a soft-deleted tag with this name exists, restore it instead of inserting a duplicate
    const softDeleted = await this.repository.findSoftDeletedByTag(dto.name, user.id);
    if (softDeleted) {
      softDeleted.deletedAt = null as unknown as Date;
      await this.repository.save(softDeleted);
      return this.repository.formatResponse(softDeleted);
    }

    const tag = this.repository.create({ user, name: dto.name });
    await this.repository.save(tag);

    return this.repository.formatResponse(tag);
  }
}
