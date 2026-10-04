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

export type ContractStatus = 'active' | 'completed' | 'cancelled';
export type ContractType = 'payable' | 'receivable';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @ManyToOne(() => Contact, { onDelete: 'RESTRICT', eager: true })
  contact: Contact;

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL', eager: true })
  wallet: Wallet | null;

  // Read straight from the foreign key, so it's set even when the wallet is soft-deleted
  @RelationId((c: Contract) => c.wallet)
  walletId: string | null;

  @Column({ type: 'varchar', length: 10, comment: 'payable | receivable' })
  type: ContractType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToMany(() => Tag, { eager: true, cascade: ['insert', 'update'] })
  @JoinTable({
    name: 'contract_tags',
    joinColumns: [{ name: 'contract_id' }],
    inverseJoinColumns: [{ name: 'tag_id' }],
  })
  tags: Tag[];

  @Column({ type: 'integer', unsigned: true })
  instalments: number;

  @Column({ type: 'integer', unsigned: true, default: 0 })
  instalmentsDone: number;

  @Column({ type: 'tinyint', unsigned: true })
  cycleMonths: number;

  @Column({ type: 'datetime' })
  firstDueDate: Date;

  @Column({ type: 'datetime' })
  nextDueDate: Date;

  @Column({ type: 'enum', enum: ['active', 'completed', 'cancelled'], default: 'active' })
  status: ContractStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
