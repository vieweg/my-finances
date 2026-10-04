import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInvoiceHistoryNullValues1749311000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE invoices SET history = '[]' WHERE history IS NULL`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // irreversible data change
  }
}
