import { User } from '../../users/models/user.model';
import { Tag } from '../../tags/models/tags.model';
import { Wallet } from '../../wallets/models/wallet.model';
import { Invoice } from '../../invoices/models/invoice.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  Index,
  RelationId,
} from 'typeorm';

@Index(['user', 'currency', 'deletedAt'])
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // null means this row IS the original; subsequent versions store the original's id
  @Column({ type: 'uuid', nullable: true, default: null })
  originalId: string | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'char', length: '3' })
  currency: string;

  @Column({ type: 'datetime' })
  date: Date;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: '10', comment: 'income | outcome' })
  type: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL' })
  wallet: Wallet | null;

  // Read straight from the foreign key, so it's set even when the wallet is soft-deleted
  @RelationId((t: Transaction) => t.wallet)
  walletId: string | null;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  invoice: Invoice | null;

  @ManyToMany(() => Tag, { eager: true, cascade: ['insert', 'update'] })
  @JoinTable({
    name: 'transactions_tags',
    joinColumns: [{ name: 'transaction_id' }],
    inverseJoinColumns: [{ name: 'tag_id' }],
  })
  tags: Tag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
