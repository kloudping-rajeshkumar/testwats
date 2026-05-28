import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledMessagesTable1780100000000 implements MigrationInterface {
  name = 'AddScheduledMessagesTable1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await this.upPostgres(queryRunner);
    } else {
      await this.upSqlite(queryRunner);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_messages_sessionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_messages_status"`);
    await queryRunner.query(`DROP TABLE "scheduled_messages"`);
  }

  private async upSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "scheduled_messages" (
        "id" varchar PRIMARY KEY NOT NULL,
        "sessionId" varchar NOT NULL,
        "chatId" varchar NOT NULL,
        "message" text NOT NULL,
        "scheduledAt" datetime NOT NULL,
        "status" varchar NOT NULL DEFAULT ('pending'),
        "errorMessage" text,
        "sentAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_messages_sessionId" ON "scheduled_messages" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_messages_status" ON "scheduled_messages" ("status")`);
  }

  private async upPostgres(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "scheduled_messages" (
        "id" varchar PRIMARY KEY NOT NULL,
        "sessionId" varchar NOT NULL,
        "chatId" varchar NOT NULL,
        "message" text NOT NULL,
        "scheduledAt" timestamp NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "sentAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_messages_sessionId" ON "scheduled_messages" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scheduled_messages_status" ON "scheduled_messages" ("status")`);
  }
}
