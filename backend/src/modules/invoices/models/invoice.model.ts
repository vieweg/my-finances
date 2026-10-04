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
  RelationId,
} from 'typeorm';
import { User } from '../../users/models/user.model';
import { Contact } from '../../contacts/models/contact.model';
import { Wallet } from '../../wallets/models/wallet.model';
import { Tag } from '../../tags/models/tags.model';
import { Contract } from '../../contracts/models/contract.model';

export interface InvoiceHistoryEvent {
  event: 'created' | 'transaction_added' | 'transaction_removed' | 'transaction_updated' | 'mark_paid' | 'mark_unpaid' | 'updated' | 'cancelled' | 'restored';
  at: string;
  status: string;
  paidAmount?: number;
  transactionId?: string;
  transactionAmount?: number;
  changes?: Record<string, unknown>;
  reason?: string;
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Contact, { onDelete: 'RESTRICT', eager: true })
  contact: Contact;

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL', eager: true })
  wallet: Wallet | null;

  // Read straight from the foreign key, so it's set even when the wallet is soft-deleted
  @RelationId((i: Invoice) => i.wallet)
  walletId: string | null;

  @Column({ type: 'varchar', length: 10, comment: 'payable | receivable' })
  type: string;

  @Column({ type: 'varchar', length: 10, default: 'pending', comment: 'pending | partial | paid | cancelled' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'datetime' })
  issueDate: Date;

  @Column({ type: 'datetime' })
  dueDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToMany(() => Tag, { eager: true, cascade: ['insert', 'update'] })
  @JoinTable({
    name: 'invoice_tags',
    joinColumns: [{ name: 'invoice_id' }],
    inverseJoinColumns: [{ name: 'tag_id' }],
  })
  tags: Tag[];

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'SET NULL' })
  contract: Contract | null;

  @Column({ type: 'json' })
  history: InvoiceHistoryEvent[] = [];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
