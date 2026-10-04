import { MigrationInterface, QueryRunner } from 'typeorm';

// Balance entries get the date they take effect on: the transaction's date, or the adjustment date.
// Every entry of a transaction (all versions) carries the date of its latest version, so a transaction
// moved to another date or wallet, or deleted, nets to zero wherever it no longer applies.
export class AddWalletSnapshotEffectiveAt1790726400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `wallet_snapshots` ADD `effectiveAt` datetime NULL');

    // Manual adjustments, and entries of hard-deleted transactions, keep the date they were recorded
    await queryRunner.query('UPDATE `wallet_snapshots` SET `effectiveAt` = `recordedAt`');
    await queryRunner.query(`
      UPDATE wallet_snapshots ws
      INNER JOIN transactions t ON t.id = ws.transactionId
      INNER JOIN transactions latest
        ON COALESCE(latest.originalId, latest.id) = COALESCE(t.originalId, t.id)
        AND latest.version = (
          SELECT MAX(v.version) FROM transactions v
          WHERE COALESCE(v.originalId, v.id) = COALESCE(t.originalId, t.id)
        )
      SET ws.effectiveAt = latest.date
    `);

    // The default lets backups taken before this column be restored; the restore recomputes it
    await queryRunner.query(
      'ALTER TABLE `wallet_snapshots` MODIFY `effectiveAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_wallet_snapshots_wallet_effective_at` ON `wallet_snapshots` (`walletId`, `effectiveAt`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_wallet_snapshots_wallet_effective_at` ON `wallet_snapshots`');
    await queryRunner.query('ALTER TABLE `wallet_snapshots` DROP COLUMN `effectiveAt`');
  }
}
