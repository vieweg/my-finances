import { MigrationInterface, QueryRunner } from 'typeorm';

// Deleting a contract is meant to set its status to cancelled, but the status wasn't saved
// before the soft delete, so deleted contracts kept their previous status (usually active).
export class FixDeletedContractsStatus1790467200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE contracts SET status = 'cancelled' WHERE deletedAt IS NOT NULL AND status <> 'cancelled'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // irreversible data change: the status before deletion is unknown
  }
}
