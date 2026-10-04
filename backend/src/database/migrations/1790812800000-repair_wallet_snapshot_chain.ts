import { MigrationInterface, QueryRunner } from 'typeorm';

// Before wallets were locked while applying transactions (2026-06-17), concurrent requests could read the
// same balance, saving entries whose amount didn't follow from the previous entry. Manual adjustments made
// afterwards got their delta from those wrong amounts, so the sum of deltas (used by the balance series)
// drifted from the balance. This recomputes the derived field of every entry, in balance order:
// a manual entry sets the balance (amount is kept, delta = amount - previous balance), a transaction
// entry changes it (delta is kept, amount = previous balance + delta). Current balances don't change.
export class RepairWalletSnapshotChain1790812800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const wallets: Array<{ walletId: string }> = await queryRunner.query(
      'SELECT DISTINCT walletId FROM wallet_snapshots WHERE walletId IS NOT NULL',
    );
    const cents = (value: string | number) => Math.round(Number(value) * 100);

    for (const { walletId } of wallets) {
      const rows: Array<{ id: string; amount: string; delta: string; source: string; recordedAt: Date; createdAt: Date }> =
        await queryRunner.query(
          'SELECT id, amount, delta, source, recordedAt, createdAt FROM wallet_snapshots WHERE walletId = ? ORDER BY recordedAt, createdAt',
          [walletId],
        );

      // Entries saved in the same instant (e.g. imported ones) have no stored order:
      // take them in the order where each follows from the previous balance, when there is one
      const ordered: typeof rows = [];
      let previous = 0;
      for (let i = 0; i < rows.length; ) {
        const instant = `${new Date(rows[i].recordedAt).getTime()}|${new Date(rows[i].createdAt).getTime()}`;
        const group: typeof rows = [];
        while (i < rows.length && `${new Date(rows[i].recordedAt).getTime()}|${new Date(rows[i].createdAt).getTime()}` === instant) {
          group.push(rows[i++]);
        }
        while (group.length) {
          const next = Math.max(group.findIndex((r) => cents(r.amount) - cents(r.delta) === previous), 0);
          const [row] = group.splice(next, 1);
          ordered.push(row);
          previous = cents(row.amount);
        }
      }

      let balance = 0;
      for (const row of ordered) {
        const amount = row.source === 'manual' ? cents(row.amount) : balance + cents(row.delta);
        const delta = amount - balance;
        balance = amount;
        if (amount !== cents(row.amount) || delta !== cents(row.delta)) {
          await queryRunner.query('UPDATE wallet_snapshots SET amount = ?, delta = ? WHERE id = ?', [
            (amount / 100).toFixed(2),
            (delta / 100).toFixed(2),
            row.id,
          ]);
        }
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // irreversible data change: the wrong amounts and deltas aren't kept
  }
}
