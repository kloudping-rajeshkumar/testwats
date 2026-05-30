import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleSheetsTables1780300000000 implements MigrationInterface {
  name = 'AddGoogleSheetsTables1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await this.upPostgres(queryRunner);
    } else {
      await this.upSqlite(queryRunner);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_google_sheets_tokenLabel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "google_sheets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "google_tokens"`);
  }

  private async upSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "google_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "label" varchar NOT NULL,
        "accessToken" varchar NOT NULL,
        "refreshToken" varchar NOT NULL,
        "expiryDate" varchar,
        "email" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_google_tokens_label" UNIQUE ("label")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "google_sheets" (
        "id" varchar PRIMARY KEY NOT NULL,
        "tokenLabel" varchar NOT NULL,
        "spreadsheetId" varchar NOT NULL,
        "title" varchar NOT NULL,
        "spreadsheetUrl" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_google_sheets_tokenLabel" ON "google_sheets" ("tokenLabel")`);
  }

  private async upPostgres(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "google_tokens" (
        "id" varchar PRIMARY KEY NOT NULL,
        "label" varchar NOT NULL,
        "accessToken" varchar NOT NULL,
        "refreshToken" varchar NOT NULL,
        "expiryDate" varchar,
        "email" varchar,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_google_tokens_label" UNIQUE ("label")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "google_sheets" (
        "id" varchar PRIMARY KEY NOT NULL,
        "tokenLabel" varchar NOT NULL,
        "spreadsheetId" varchar NOT NULL,
        "title" varchar NOT NULL,
        "spreadsheetUrl" varchar,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_google_sheets_tokenLabel" ON "google_sheets" ("tokenLabel")`);
  }
}
