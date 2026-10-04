import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContactRepository from '../repositories/contact.repository';
import { ContactQueryDto, ContactResponseDto } from '../dtos';

export default class RestoreContactService {
  private contactRepository: ContactRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
  }

  async execute(dto: ContactQueryDto): Promise<ContactResponseDto> {
    const contact = await this.contactRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!contact) throw new AppError('Contact not found', 404);
    if (!contact.deletedAt) throw new AppError('Contact is not deleted', 400);

    contact.deletedAt = null as unknown as Date;
    await this.contactRepository.save(contact);

    return this.contactRepository.formatResponse(contact);
  }
}
