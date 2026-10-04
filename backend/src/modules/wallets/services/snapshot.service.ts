import { dataSource } from '../../../database';
import { Wallet } from '../models/wallet.model';
import { WalletSnapshot } from '../models/wallet-snapshot.model';

export default class WalletSnapshotService {

  static signedAmount(total: number, type: string): number {
    return type === 'income' ? Number(total) : -Number(total);
  }

  async applyWalletTransition(
    from: { walletId: string | null; total: number; type: string },
    to: { walletId: string | null; total: number; type: string },
    userId: string,
    transactionId: string,
    effectiveAt: Date,
  ): Promise<void> {
    const oldSigned = WalletSnapshotService.signedAmount(from.total, from.type);
    const newSigned = WalletSnapshotService.signedAmount(to.total, to.type);

    if (from.walletId === to.walletId) {
      if (to.walletId) {
        const net = newSigned - oldSigned;
        if (net !== 0) {
          await this.applyTransactionDelta(to.walletId, userId, net, transactionId, effectiveAt);
        }
      }
    } else {
      if (from.walletId) {
        await this.applyTransactionDelta(from.walletId, userId, -oldSigned, transactionId, effectiveAt);
      }
      if (to.walletId) {
        await this.applyTransactionDelta(to.walletId, userId, newSigned, transactionId, effectiveAt);
      }
    }
  }

  async applyTransactionDelta(
    walletId: string,
    userId: string,
    delta: number,
    transactionId: string,
    effectiveAt: Date,
    attempt = 0,
  ): Promise<void> {
    const MAX_RETRIES = 3;
    try {
      await dataSource.manager.transaction(async (manager) => {
        // Pessimistic write lock serializes concurrent calls for the same wallet,
        // preventing the race condition where two requests read the same stale balance.
        const wallet = await manager.findOne(Wallet, {
          where: { id: walletId, user: { id: userId } },
          lock: { mode: 'pessimistic_write' },
        });
        if (!wallet) return;

        const latest = await manager.findOne(WalletSnapshot, {
          where: { wallet: { id: walletId } },
          order: { recordedAt: 'DESC', createdAt: 'DESC' },
        });
        const currentBalance = latest ? Number(latest.amount) : 0;

        const snapshot = manager.create(WalletSnapshot, {
          wallet,
          amount: currentBalance + delta,
          delta,
          source: 'transaction',
          transactionId,
          recordedAt: new Date(),
          effectiveAt,
        });
        await manager.save(WalletSnapshot, snapshot);
      });
    } catch (err: any) {
      if (attempt < MAX_RETRIES && err?.errno === 1213) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        return this.applyTransactionDelta(walletId, userId, delta, transactionId, effectiveAt, attempt + 1);
      }
      throw err;
    }
  }

  // Moves every entry of a transaction (all its versions, in any wallet) to its current date,
  // so a changed date also moves the change that earlier versions made to the balance
  async moveTransactionEntries(originalId: string, effectiveAt: Date): Promise<void> {
    await dataSource.query(
      `UPDATE wallet_snapshots SET effectiveAt = ?
       WHERE transactionId IN (SELECT id FROM transactions WHERE id = ? OR originalId = ?)`,
      [effectiveAt, originalId, originalId],
    );
  }
}
