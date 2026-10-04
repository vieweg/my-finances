import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import { User } from '../../users/models/user.model';
import { CreateUserService } from '../../users/services';
import { CreateUserDto, UserResponseDto } from '../../users/dtos';

// Deleted users count too: setup is only for a database that has never had an account
const hasUsers = async (): Promise<boolean> =>
  (await dataSource.getRepository(User).count({ withDeleted: true })) > 0;

export class GetSetupStatusService {
  async execute(): Promise<{ needsSetup: boolean }> {
    return { needsSetup: !(await hasUsers()) };
  }
}

export class CompleteSetupService {
  async execute(userData: CreateUserDto): Promise<UserResponseDto> {
    // A named lock serialises concurrent requests, so only one first account can be created
    const lockName = `setup:${process.env.DB_NAME}`;
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [{ locked }] = await queryRunner.query('SELECT GET_LOCK(?, 10) AS locked', [lockName]);
      if (Number(locked) !== 1) throw new AppError('Setup is busy, please try again', 503);
      try {
        if (await hasUsers()) throw new AppError('Setup has already been completed', 409);
        return await new CreateUserService().execute(userData);
      } finally {
        await queryRunner.query('SELECT RELEASE_LOCK(?)', [lockName]);
      }
    } finally {
      await queryRunner.release();
    }
  }
}
