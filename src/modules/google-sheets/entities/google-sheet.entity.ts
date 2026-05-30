import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('google_sheets')
export class GoogleSheet {
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
  tokenLabel: string;

  @Column()
  spreadsheetId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  spreadsheetUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
