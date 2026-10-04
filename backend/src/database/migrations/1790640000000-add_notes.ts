import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotes1790640000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `transactions` ADD `notes` text NULL');
    await queryRunner.query('ALTER TABLE `invoices` ADD `notes` text NULL');
    await queryRunner.query('ALTER TABLE `contracts` ADD `notes` text NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `contracts` DROP COLUMN `notes`');
    await queryRunner.query('ALTER TABLE `invoices` DROP COLUMN `notes`');
    await queryRunner.query('ALTER TABLE `transactions` DROP COLUMN `notes`');
  }
}
