import { DataSource, Repository } from 'typeorm';
import { User } from '../models/user.model';
import { UserResponseDto } from '../dtos';

export default class UserRepository extends Repository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async findAll(): Promise<User[]> {
    return this.find();
  }

  async findById(id: string): Promise<User | null> {
    if (!id) return null;

    return this.findOne({ where: { id } });
  }

  async findByEmailOrUsername(value: string, withDeleted = false): Promise<User | null> {
    if (!value) return null;

    const where = [{ username: value }, { email: value }];

    const results = await this.find({
      where,
      withDeleted,
    });

    return results.length > 0 ? results[0] : null;
  }

  formatResponse(user: User): UserResponseDto;
  formatResponse(user: User[]): UserResponseDto[];
  formatResponse(user: User | User[]): UserResponseDto | UserResponseDto[] {
    const formatSingleResponse = (user: User): UserResponseDto => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(user.deletedAt && { deletedAt: user.deletedAt }),
    });

    if (Array.isArray(user)) {
      return user.map(formatSingleResponse);
    }
    return formatSingleResponse(user);
  }
}
