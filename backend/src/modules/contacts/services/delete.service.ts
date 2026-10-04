import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContactRepository from '../repositories/contact.repository';
import InvoiceRepository from '../../invoices/repositories/invoice.repository';
import { ContactQueryDto, ContactResponseDto } from '../dtos';

export default class DeleteContactService {
  private contactRepository: ContactRepository;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.contactRepository = new ContactRepository(dataSource);
    this.invoiceRepository = new InvoiceRepository(dataSource);
  }

  async execute(dto: ContactQueryDto): Promise<ContactResponseDto> {
    const contact = await this.contactRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!contact) throw new AppError('Contact not found', 404);

    const invoiceCount = await this.invoiceRepository.count({
      where: { contact: { id: contact.id } },
      withDeleted: true,
    });
    if (invoiceCount > 0) {
      throw new AppError('Cannot delete a contact that has invoices', 400);
    }

    if (dto.remove) {
      return this.contactRepository.formatResponse(await this.contactRepository.remove(contact));
    }

    return this.contactRepository.formatResponse(await this.contactRepository.softRemove(contact));
  }
}
