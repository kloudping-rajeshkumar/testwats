import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactsTable1780000000000 implements MigrationInterface {
  name = 'AddContactsTable1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await this.upPostgres(queryRunner);
    } else {
      await this.upSqlite(queryRunner);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contacts_sessionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contacts_chatId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contacts_sessionId_chatId"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
  }

  private async upSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contacts" (
        "id" varchar PRIMARY KEY NOT NULL,
        "sessionId" varchar NOT NULL,
        "chatId" varchar NOT NULL,
        "phone" varchar NOT NULL DEFAULT '',
        "name" varchar,
        "pushName" varchar,
        "isGroup" boolean NOT NULL DEFAULT (0),
        "profilePicUrl" varchar,
        "status" varchar NOT NULL DEFAULT ('active'),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_contacts_session_chat" UNIQUE ("sessionId", "chatId")
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_contacts_sessionId" ON "contacts" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_chatId" ON "contacts" ("chatId")`);
  }

  private async upPostgres(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contacts" (
        "id" varchar PRIMARY KEY NOT NULL,
        "sessionId" varchar NOT NULL,
        "chatId" varchar NOT NULL,
        "phone" varchar NOT NULL DEFAULT '',
        "name" varchar,
        "pushName" varchar,
        "isGroup" boolean NOT NULL DEFAULT false,
        "profilePicUrl" varchar,
        "status" varchar NOT NULL DEFAULT 'active',
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_contacts_session_chat" UNIQUE ("sessionId", "chatId")
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_contacts_sessionId" ON "contacts" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_chatId" ON "contacts" ("chatId")`);
  }
}
