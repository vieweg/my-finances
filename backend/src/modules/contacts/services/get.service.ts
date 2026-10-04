import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContactRepository from '../repositories/contact.repository';
import { ContactQueryDto, ContactResponseDto } from '../dtos';

export default class GetContactService {
  private contactRepository: ContactRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
  }

  async execute(dto: ContactQueryDto): Promise<ContactResponseDto> {
    const contact = await this.contactRepository.findById(dto.id, dto.userId, dto.deleted);
    if (!contact) throw new AppError('Contact not found', 404);

    return this.contactRepository.formatResponse(contact);
  }
}
