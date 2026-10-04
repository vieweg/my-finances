import { dataSource } from '../../../database';
import ContractRepository from '../repositories/contract.repository';
import { ListContractsDto, ContractResponseDto } from '../dtos';
import { PAGINATION_CONTRACTS } from '../../../constants';
import { paginate, PaginatedResponseDto } from '../../../utils/pagination';

export default class ListContractsService {
  private contractRepository: ContractRepository;

  constructor() {
    this.contractRepository = new ContractRepository(dataSource);
  }

  async execute(dto: ListContractsDto): Promise<PaginatedResponseDto<ContractResponseDto>> {
    const [contracts, total] = await this.contractRepository.findAll(dto);
    return paginate(
      contracts.map((c) => this.contractRepository.formatResponse(c)),
      total,
      dto.page ?? PAGINATION_CONTRACTS.DEFAULT_PAGE,
      dto.limit ?? PAGINATION_CONTRACTS.DEFAULT_LIMIT,
    );
  }
}
