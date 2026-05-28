import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('contacts')
@Unique(['sessionId', 'chatId'])
export class Contact {
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
  @Index()
  chatId: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  pushName: string;

  @Column({ default: false })
  isGroup: boolean;

  @Column({ nullable: true })
  profilePicUrl: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
