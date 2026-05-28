import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageTemplatesTable1780200000000 implements MigrationInterface {
  name = 'AddMessageTemplatesTable1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await this.upPostgres(queryRunner);
    } else {
      await this.upSqlite(queryRunner);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_templates_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_templates_category"`);
    await queryRunner.query(`DROP TABLE "message_templates"`);
  }

  private async upSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message_templates" (
        "id" varchar PRIMARY KEY NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar,
        "body" text NOT NULL,
        "language" varchar,
        "isActive" boolean NOT NULL DEFAULT (1),
        "usageCount" integer NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_message_templates_name" ON "message_templates" ("name")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_templates_category" ON "message_templates" ("category")`);
  }

  private async upPostgres(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message_templates" (
        "id" varchar PRIMARY KEY NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar,
        "body" text NOT NULL,
        "language" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "usageCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_message_templates_name" ON "message_templates" ("name")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_templates_category" ON "message_templates" ("category")`);
  }
}
