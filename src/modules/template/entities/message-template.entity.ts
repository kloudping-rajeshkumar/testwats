import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('message_templates')
export class MessageTemplate {
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
  name: string;

  @Column({ nullable: true })
  category: string; // e.g. 'greeting', 'reminder', 'promotion', 'follow-up', 'custom'

  @Column({ type: 'text' })
  body: string; // message body, supports {{name}}, {{phone}}, {{date}} placeholders

  @Column({ nullable: true })
  language: string; // e.g. 'en', 'hi', 'ta'

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
