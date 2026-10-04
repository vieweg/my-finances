import { dataSource } from '../../../database';
import ContactRepository from '../repositories/contact.repository';
import { ListContactsDto, ContactResponseDto } from '../dtos';
import { PAGINATION_CONTACTS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class ListContactsService {
  private contactRepository: ContactRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
  }

  async execute(dto: ListContactsDto): Promise<PaginatedResponseDto<ContactResponseDto>> {
    const page = dto.page ?? PAGINATION_CONTACTS.DEFAULT_PAGE;
    const limit = dto.limit ?? PAGINATION_CONTACTS.DEFAULT_LIMIT;
    const [contacts, total] = await this.contactRepository.findAll(dto);
    return paginate(this.contactRepository.formatResponse(contacts), total, page, limit);
  }
}
