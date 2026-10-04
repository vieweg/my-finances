import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import UserRepository from '../../users/repositories/user.repository';
import ContactRepository from '../repositories/contact.repository';
import { CreateContactDto, ContactResponseDto } from '../dtos';

export default class CreateContactService {
  private contactRepository: ContactRepository;
  private userRepository: UserRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(dto: CreateContactDto): Promise<ContactResponseDto> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new AppError('User not found', 401);

    const contact = this.contactRepository.create({
      user,
      name: dto.name,
      document: dto.document,
      email: dto.email,
      phone: dto.phone,
      notes: dto.notes,
    });
    await this.contactRepository.save(contact);

    return this.contactRepository.formatResponse(contact);
  }
}
