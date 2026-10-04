import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContractRepository from '../repositories/contract.repository';
import { ContractQueryDto, ContractResponseDto } from '../dtos';

export default class DeleteContractService {
  private contractRepository: ContractRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
  }

  async execute(dto: ContractQueryDto): Promise<ContractResponseDto> {
    const contract = await this.contractRepository.findOne({
      where: { id: dto.id, user: { id: dto.userId } },
      withDeleted: true,
    });
    if (!contract) throw new AppError('Contract not found', 404);

    if (dto.remove === 'remove') {
      await this.contractRepository.remove(contract);
      return this.contractRepository.formatResponse(contract);
    }

    // softRemove only writes deletedAt, so the status has to be saved first
    contract.status = 'cancelled';
    await this.contractRepository.save(contract);
    await this.contractRepository.softRemove(contract);
    return this.contractRepository.formatResponse(contract);
  }
}
