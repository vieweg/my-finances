import { Wallet } from './wallet.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';

@Index('IDX_wallet_snapshots_wallet_effective_at', ['wallet', 'effectiveAt'])
@Entity('wallet_snapshots')
export class WalletSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  wallet: Wallet;

  // Absolute balance after this snapshot
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  // Signed change that produced this snapshot
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  delta: number;

  @Column({ type: 'varchar', length: 20, comment: 'manual | transaction' })
  source: 'manual' | 'transaction';

  @Column({ type: 'uuid', nullable: true, default: null })
  transactionId: string | null;

  @Column({ type: 'datetime' })
  recordedAt: Date;

  // When the change counts towards the balance: the transaction's date, or the adjustment date.
  // All entries of a transaction (every version) share the date of its latest version.
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  effectiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
