import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

export enum ScheduleStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('scheduled_messages')
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  @Index()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'text' })
  message: string;

  @Column()
  scheduledAt: Date;

  @Column({ type: 'varchar', default: ScheduleStatus.PENDING })
  @Index()
  status: ScheduleStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
