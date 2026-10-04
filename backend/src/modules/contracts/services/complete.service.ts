import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import ContractRepository from '../repositories/contract.repository';
import GetContractService from './get.service';
import { ContractQueryDto, ContractResponseDto } from '../dtos';

// Ends an active contract early (recurring or before all instalments were generated).
// Invoices already generated are kept; no new ones are generated.
export default class CompleteContractService {
  private contractRepository: ContractRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
  }

  async execute(dto: ContractQueryDto): Promise<ContractResponseDto> {
    const contract = await this.contractRepository.findById(dto.id, dto.userId);
    if (!contract) throw new AppError('Contract not found', 404);
    if (contract.status !== 'active') throw new AppError('Contract is not active', 400);

    contract.status = 'completed';
    await this.contractRepository.save(contract);

    return new GetContractService().execute({ id: contract.id, userId: dto.userId });
  }
}
