import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleToken } from './entities/google-token.entity';
import { GoogleSheet } from './entities/google-sheet.entity';
import { CreateSheetDto, UpdateSheetDto, ShareSheetDto, AppendRowsDto } from './dto';
import { ShareRole } from './dto/share-sheet.dto';

@Injectable()
export class GoogleSheetsService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    @InjectRepository(GoogleToken, 'data')
    private readonly tokenRepository: Repository<GoogleToken>,
    @InjectRepository(GoogleSheet, 'data')
    private readonly sheetRepository: Repository<GoogleSheet>,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('google.clientId', '');
    this.clientSecret = this.configService.get<string>('google.clientSecret', '');
    this.redirectUri = this.configService.get<string>('google.redirectUri', 'http://localhost:2785/api/google-sheets/oauth/callback');
  }

  private createOAuth2Client(): OAuth2Client {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Google OAuth2 credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  getAuthUrl(label: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: label,
    });
  }

  async handleOAuthCallback(code: string, label: string): Promise<GoogleToken> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new BadRequestException('No refresh token received. Revoke app access in Google Account settings and try again.');
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const existing = await this.tokenRepository.findOne({ where: { label } });
    if (existing) {
      existing.accessToken = tokens.access_token!;
      existing.refreshToken = tokens.refresh_token;
      existing.expiryDate = tokens.expiry_date?.toString() || '';
      existing.email = userInfo.email || '';
      return this.tokenRepository.save(existing);
    }

    const token = new GoogleToken();
    token.label = label;
    token.accessToken = tokens.access_token!;
    token.refreshToken = tokens.refresh_token;
    token.expiryDate = tokens.expiry_date?.toString() || '';
    token.email = userInfo.email || '';
    return this.tokenRepository.save(token);
  }

  private async getAuthenticatedClient(tokenLabel: string): Promise<OAuth2Client> {
    const token = await this.tokenRepository.findOne({ where: { label: tokenLabel } });
    if (!token) {
      throw new NotFoundException(`Google account "${tokenLabel}" not found. Connect it first via /api/google-sheets/auth.`);
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate ? parseInt(token.expiryDate) : undefined,
    });

    oauth2Client.on('tokens', async (newTokens) => {
      if (newTokens.access_token) {
        token.accessToken = newTokens.access_token;
      }
      if (newTokens.expiry_date) {
        token.expiryDate = newTokens.expiry_date.toString();
      }
      await this.tokenRepository.save(token);
    });

    return oauth2Client;
  }

  private async getSheetsApi(tokenLabel: string): Promise<sheets_v4.Sheets> {
    const auth = await this.getAuthenticatedClient(tokenLabel);
    return google.sheets({ version: 'v4', auth });
  }

  private async getDriveApi(tokenLabel: string): Promise<drive_v3.Drive> {
    const auth = await this.getAuthenticatedClient(tokenLabel);
    return google.drive({ version: 'v3', auth });
  }

  async listAccounts() {
    const tokens = await this.tokenRepository.find({ order: { createdAt: 'DESC' } });
    return tokens.map((t) => ({
      id: t.id,
      label: t.label,
      email: t.email,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async removeAccount(label: string): Promise<void> {
    const token = await this.tokenRepository.findOne({ where: { label } });
    if (!token) {
      throw new NotFoundException(`Google account "${label}" not found.`);
    }
    await this.tokenRepository.remove(token);
  }

  async createSpreadsheet(dto: CreateSheetDto): Promise<GoogleSheet> {
    const sheets = await this.getSheetsApi(dto.tokenLabel);

    const sheetTabs = (dto.sheetNames || ['Sheet1']).map((title) => ({
      properties: { title },
    }));

    const { data: spreadsheet } = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: dto.title },
        sheets: sheetTabs,
      },
    });

    if (dto.headers && dto.headers.length > 0) {
      const firstSheetTitle = dto.sheetNames?.[0] || 'Sheet1';
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet.spreadsheetId!,
        range: `${firstSheetTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [dto.headers] },
      });
    }

    const record = new GoogleSheet();
    record.tokenLabel = dto.tokenLabel;
    record.spreadsheetId = spreadsheet.spreadsheetId!;
    record.title = dto.title;
    record.spreadsheetUrl = spreadsheet.spreadsheetUrl || '';
    return this.sheetRepository.save(record);
  }

  async getSpreadsheet(tokenLabel: string, spreadsheetId: string) {
    const sheets = await this.getSheetsApi(tokenLabel);
    const { data } = await sheets.spreadsheets.get({ spreadsheetId });
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title,
      url: data.spreadsheetUrl,
      sheets: data.sheets?.map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      })),
    };
  }

  async readRange(tokenLabel: string, spreadsheetId: string, range: string) {
    const sheets = await this.getSheetsApi(tokenLabel);
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return {
      range: data.range,
      values: data.values || [],
    };
  }

  async updateRange(spreadsheetId: string, dto: UpdateSheetDto) {
    const sheets = await this.getSheetsApi(dto.tokenLabel);
    const { data } = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: dto.range,
      valueInputOption: dto.valueInputOption || 'USER_ENTERED',
      requestBody: { values: dto.values },
    });
    return {
      updatedRange: data.updatedRange,
      updatedRows: data.updatedRows,
      updatedColumns: data.updatedColumns,
      updatedCells: data.updatedCells,
    };
  }

  async appendRows(spreadsheetId: string, dto: AppendRowsDto) {
    const sheets = await this.getSheetsApi(dto.tokenLabel);
    const { data } = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: dto.range || 'Sheet1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: dto.values },
    });
    return {
      updatedRange: data.updates?.updatedRange,
      updatedRows: data.updates?.updatedRows,
      updatedCells: data.updates?.updatedCells,
    };
  }

  async clearRange(tokenLabel: string, spreadsheetId: string, range: string) {
    const sheets = await this.getSheetsApi(tokenLabel);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
    return { cleared: true, range };
  }

  async deleteSpreadsheet(tokenLabel: string, spreadsheetId: string): Promise<void> {
    // Try to delete from Google Drive; if Drive API is not enabled, just remove locally
    try {
      const drive = await this.getDriveApi(tokenLabel);
      await drive.files.delete({ fileId: spreadsheetId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Drive API') || msg.includes('SERVICE_DISABLED') || msg.includes('accessNotConfigured')) {
        // Drive API not enabled — skip remote delete, just remove from local DB
        console.warn('Drive API not enabled — removing spreadsheet from local DB only');
      } else {
        throw err;
      }
    }
    await this.sheetRepository.delete({ spreadsheetId });
  }

  async shareSpreadsheet(spreadsheetId: string, dto: ShareSheetDto) {
    const drive = await this.getDriveApi(dto.tokenLabel);
    try {
      const { data } = await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: dto.sendNotification !== false,
        emailMessage: dto.message,
        requestBody: {
          type: 'user',
          role: dto.role || ShareRole.READER,
          emailAddress: dto.emailAddress,
        },
      });
      return {
        permissionId: data.id,
        role: data.role,
        emailAddress: dto.emailAddress,
      };
    } catch (err: unknown) {
      this.throwIfDriveDisabled(err);
      throw err;
    }
  }

  async listPermissions(tokenLabel: string, spreadsheetId: string) {
    const drive = await this.getDriveApi(tokenLabel);
    try {
      const { data } = await drive.permissions.list({
        fileId: spreadsheetId,
        fields: 'permissions(id,type,role,emailAddress,displayName)',
      });
      return data.permissions || [];
    } catch (err: unknown) {
      this.throwIfDriveDisabled(err);
      throw err;
    }
  }

  async removePermission(tokenLabel: string, spreadsheetId: string, permissionId: string): Promise<void> {
    const drive = await this.getDriveApi(tokenLabel);
    try {
      await drive.permissions.delete({
        fileId: spreadsheetId,
        permissionId,
      });
    } catch (err: unknown) {
      this.throwIfDriveDisabled(err);
      throw err;
    }
  }

  async exportAsBuffer(tokenLabel: string, spreadsheetId: string, mimeType: string): Promise<Buffer> {
    const drive = await this.getDriveApi(tokenLabel);
    try {
      const { data } = await drive.files.export(
        { fileId: spreadsheetId, mimeType },
        { responseType: 'arraybuffer' },
      );
      return Buffer.from(data as ArrayBuffer);
    } catch (err: unknown) {
      this.throwIfDriveDisabled(err);
      throw err;
    }
  }

  /** Throw a clear 400 error if Drive API is not enabled in the Google Cloud project. */
  private throwIfDriveDisabled(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Drive API') || msg.includes('SERVICE_DISABLED') || msg.includes('accessNotConfigured')) {
      throw new BadRequestException(
        'Google Drive API is not enabled in your Google Cloud project. ' +
        'Enable it at: https://console.developers.google.com/apis/api/drive.googleapis.com/overview',
      );
    }
  }

  async listSavedSheets(tokenLabel?: string): Promise<GoogleSheet[]> {
    const where = tokenLabel ? { tokenLabel } : {};
    return this.sheetRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  /**
   * Sync spreadsheets from Google Drive into the local database.
   * Tries Drive API first; if Drive API is not enabled, falls back
   * to re-fetching metadata for already-known sheets via the Sheets API.
   */
  async syncFromDrive(tokenLabel: string): Promise<{ synced: number; total: number }> {
    try {
      return await this.syncViaDriveApi(tokenLabel);
    } catch (err: unknown) {
      // If Drive API is not enabled (403 SERVICE_DISABLED), fall back to Sheets-only sync
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Drive API') || errMsg.includes('SERVICE_DISABLED') || errMsg.includes('accessNotConfigured')) {
        throw new BadRequestException(
          'Google Drive API is not enabled in your Google Cloud project. ' +
          'Please enable it at https://console.developers.google.com/apis/api/drive.googleapis.com/overview ' +
          'and try again. You can also use "Import by URL" to add individual spreadsheets.',
        );
      }
      throw err;
    }
  }

  private async syncViaDriveApi(tokenLabel: string): Promise<{ synced: number; total: number }> {
    const drive = await this.getDriveApi(tokenLabel);

    const spreadsheets: { id: string; name: string; webViewLink: string }[] = [];
    let nextPageToken: string | undefined;

    do {
      const { data } = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'nextPageToken, files(id, name, webViewLink)',
        pageSize: 100,
        orderBy: 'modifiedTime desc',
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      });

      if (data.files) {
        for (const f of data.files) {
          if (f.id && f.name) {
            spreadsheets.push({
              id: f.id,
              name: f.name,
              webViewLink: f.webViewLink || '',
            });
          }
        }
      }
      nextPageToken = data.nextPageToken ? String(data.nextPageToken) : undefined;
    } while (nextPageToken);

    let synced = 0;
    for (const file of spreadsheets) {
      const existing = await this.sheetRepository.findOne({
        where: { spreadsheetId: file.id, tokenLabel },
      });
      if (existing) {
        if (existing.title !== file.name || existing.spreadsheetUrl !== file.webViewLink) {
          existing.title = file.name;
          existing.spreadsheetUrl = file.webViewLink;
          await this.sheetRepository.save(existing);
          synced++;
        }
      } else {
        const record = new GoogleSheet();
        record.tokenLabel = tokenLabel;
        record.spreadsheetId = file.id;
        record.title = file.name;
        record.spreadsheetUrl = file.webViewLink;
        await this.sheetRepository.save(record);
        synced++;
      }
    }

    return { synced, total: spreadsheets.length };
  }

  /**
   * Import a single spreadsheet by URL or ID into the local database.
   * Uses the Sheets API only (no Drive API needed).
   */
  async importByUrl(tokenLabel: string, spreadsheetUrl: string): Promise<GoogleSheet> {
    // Extract spreadsheet ID from URL or use as-is
    const idMatch = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const spreadsheetId = idMatch ? idMatch[1] : spreadsheetUrl.trim();

    // Check if already imported
    const existing = await this.sheetRepository.findOne({
      where: { spreadsheetId, tokenLabel },
    });
    if (existing) {
      // Refresh title from Google
      const info = await this.getSpreadsheet(tokenLabel, spreadsheetId);
      existing.title = info.title || existing.title;
      existing.spreadsheetUrl = info.url || existing.spreadsheetUrl;
      return this.sheetRepository.save(existing);
    }

    // Fetch metadata via Sheets API
    const info = await this.getSpreadsheet(tokenLabel, spreadsheetId);

    const record = new GoogleSheet();
    record.tokenLabel = tokenLabel;
    record.spreadsheetId = spreadsheetId;
    record.title = info.title || 'Untitled';
    record.spreadsheetUrl = info.url || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return this.sheetRepository.save(record);
  }
}
