import { dataSource } from '../../../database';
import Repository from '../repositories/tag.repository';
import { ListTagDto, TagResponseDto } from '../dtos';
import { PAGINATION_TAGS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class ListService {
  private repository: Repository;

  constructor() {
    this.repository = new Repository(dataSource);
  }

  async execute(params: ListTagDto): Promise<PaginatedResponseDto<TagResponseDto>> {
    const page = params.page ?? PAGINATION_TAGS.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION_TAGS.DEFAULT_LIMIT;
    const [tags, total] = await this.repository.findAll(params);
    return paginate(this.repository.formatResponse(tags), total, page, limit);
  }
}
