import { dataSource } from '../../../database';
import { UpdateTagDto, TagResponseDto } from '../dtos';
import Repository from '../repositories/tag.repository';
import UserRepository from '../../users/repositories/user.repository';
import AppError from '../../../errors/AppError';

export default class UpdateService {
  private repository: Repository;
  private userRepository: UserRepository;

  constructor() {
    this.repository = new Repository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(dto: UpdateTagDto): Promise<TagResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    const data = await this.repository.findById(dto.id, dto.userId);
    if (!data) {
      throw new AppError('Tag not found', 404);
    }

    if (dto.name && dto.name !== data.name) {
      const existingTag = await this.repository.findOneByTag(dto.name, user.id);
      if (existingTag) {
        throw new AppError('Tag already exists', 400);
      }
    }

    const updated = await this.repository.save(dto);

    return this.repository.formatResponse(updated);
  }
}
