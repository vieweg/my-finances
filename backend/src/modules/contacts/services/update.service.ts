import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContactRepository from '../repositories/contact.repository';
import { UpdateContactDto, ContactResponseDto } from '../dtos';

export default class UpdateContactService {
  private contactRepository: ContactRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
  }

  async execute(dto: UpdateContactDto): Promise<ContactResponseDto> {
    const contact = await this.contactRepository.findById(dto.id, dto.userId);
    if (!contact) throw new AppError('Contact not found', 404);

    Object.assign(contact, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.document !== undefined && { document: dto.document }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    await this.contactRepository.save(contact);

    return this.contactRepository.formatResponse(contact);
  }
}
