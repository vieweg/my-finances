import { MigrationInterface, QueryRunner } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from '../../modules/users/models/user.model';

// The first account; set ADMIN_* to choose its credentials (read only when this migration runs)
const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const name = 'Admin';
const usuario = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'please_change_me';

export class CreateAdminUser1751566487484 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const encriptedPassword = bcrypt.hashSync(password, 10);
    await queryRunner.manager.insert(User, {
      name: name,
      email: email,
      password: encriptedPassword,
      username: usuario,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.delete(User, { email: email });
  }
}
