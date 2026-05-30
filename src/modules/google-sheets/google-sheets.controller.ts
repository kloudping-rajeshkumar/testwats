import { Controller, Get, Post, Put, Delete, Param, Body, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleSheetsService } from './google-sheets.service';
import { SessionService } from '../session/session.service';
import { Public } from '../auth/decorators/auth.decorators';
import { ConnectGoogleDto, CreateSheetDto, UpdateSheetDto, ShareSheetDto, SendSheetDto, AppendRowsDto } from './dto';
import { SendFormat } from './dto/send-sheet.dto';

@ApiTags('google-sheets')
@Controller('google-sheets')
export class GoogleSheetsController {
  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly sessionService: SessionService,
  ) {}

  // ── OAuth Flow ─────────────────────────────────────────────────────

  @Post('auth')
  @ApiOperation({ summary: 'Get Google OAuth2 authorization URL' })
  @ApiResponse({ status: 200, description: 'Returns the auth URL to redirect the user to' })
  getAuthUrl(@Body() dto: ConnectGoogleDto) {
    const url = this.googleSheetsService.getAuthUrl(dto.label);
    return { url, label: dto.label };
  }

  @Public()
  @Get('oauth/callback')
  @ApiOperation({ summary: 'OAuth2 callback endpoint (Google redirects here)' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') label: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      res.status(400).send(`<html><body><h2>Google OAuth Error</h2><p>${error}</p></body></html>`);
      return;
    }
    try {
      await this.googleSheetsService.handleOAuthCallback(code, label);
      res.send(`<html><body><h2>Google account "${label}" connected successfully!</h2><p>You can close this window and refresh the dashboard.</p></body></html>`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Google OAuth callback error:', message);
      res.status(500).send(`<html><body><h2>Connection Failed</h2><p>${message}</p></body></html>`);
    }
  }

  // ── Account Management ─────────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List connected Google accounts' })
  @ApiResponse({ status: 200, description: 'List of connected accounts (tokens masked)' })
  async listAccounts() {
    return this.googleSheetsService.listAccounts();
  }

  @Delete('accounts/:label')
  @ApiOperation({ summary: 'Disconnect a Google account' })
  @ApiParam({ name: 'label', description: 'Account label' })
  @ApiResponse({ status: 200, description: 'Account disconnected' })
  async removeAccount(@Param('label') label: string) {
    await this.googleSheetsService.removeAccount(label);
    return { success: true, message: `Account "${label}" disconnected` };
  }

  // ── Sync from Google Drive ──────────────────────────────────────────

  @Post('spreadsheets/sync')
  @ApiOperation({ summary: 'Sync spreadsheets from Google Drive into local database' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Sync result with count of synced sheets' })
  async syncFromDrive(@Query('tokenLabel') tokenLabel: string) {
    return this.googleSheetsService.syncFromDrive(tokenLabel);
  }

  @Post('spreadsheets/import')
  @ApiOperation({ summary: 'Import an existing spreadsheet by URL or ID' })
  @ApiResponse({ status: 200, description: 'Spreadsheet imported' })
  async importByUrl(@Body() body: { tokenLabel: string; spreadsheetUrl: string }) {
    return this.googleSheetsService.importByUrl(body.tokenLabel, body.spreadsheetUrl);
  }

  // ── Spreadsheet CRUD ───────────────────────────────────────────────

  @Post('spreadsheets')
  @ApiOperation({ summary: 'Create a new Google Spreadsheet' })
  @ApiResponse({ status: 201, description: 'Spreadsheet created' })
  async createSpreadsheet(@Body() dto: CreateSheetDto) {
    return this.googleSheetsService.createSpreadsheet(dto);
  }

  @Get('spreadsheets')
  @ApiOperation({ summary: 'List saved spreadsheets' })
  @ApiQuery({ name: 'tokenLabel', required: false, description: 'Filter by Google account label' })
  @ApiResponse({ status: 200, description: 'List of spreadsheets' })
  async listSpreadsheets(@Query('tokenLabel') tokenLabel?: string) {
    return this.googleSheetsService.listSavedSheets(tokenLabel);
  }

  @Get('spreadsheets/:spreadsheetId')
  @ApiOperation({ summary: 'Get spreadsheet metadata' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Spreadsheet details' })
  async getSpreadsheet(
    @Param('spreadsheetId') spreadsheetId: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    return this.googleSheetsService.getSpreadsheet(tokenLabel, spreadsheetId);
  }

  @Delete('spreadsheets/:spreadsheetId')
  @ApiOperation({ summary: 'Delete a spreadsheet' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Spreadsheet deleted' })
  async deleteSpreadsheet(
    @Param('spreadsheetId') spreadsheetId: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    await this.googleSheetsService.deleteSpreadsheet(tokenLabel, spreadsheetId);
    return { success: true, message: 'Spreadsheet deleted' };
  }

  // ── Data Operations ────────────────────────────────────────────────

  @Get('spreadsheets/:spreadsheetId/values/:range')
  @ApiOperation({ summary: 'Read cell values from a range' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiParam({ name: 'range', description: 'A1 range notation (e.g. Sheet1!A1:C10)' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Cell values' })
  async readRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    return this.googleSheetsService.readRange(tokenLabel, spreadsheetId, range);
  }

  @Put('spreadsheets/:spreadsheetId/values')
  @ApiOperation({ summary: 'Update cell values in a range' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiResponse({ status: 200, description: 'Cells updated' })
  async updateRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: UpdateSheetDto,
  ) {
    return this.googleSheetsService.updateRange(spreadsheetId, dto);
  }

  @Post('spreadsheets/:spreadsheetId/values/append')
  @ApiOperation({ summary: 'Append rows to the spreadsheet' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiResponse({ status: 200, description: 'Rows appended' })
  async appendRows(
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: AppendRowsDto,
  ) {
    return this.googleSheetsService.appendRows(spreadsheetId, dto);
  }

  @Delete('spreadsheets/:spreadsheetId/values/:range')
  @ApiOperation({ summary: 'Clear values in a range' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiParam({ name: 'range', description: 'A1 range notation' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Range cleared' })
  async clearRange(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('range') range: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    return this.googleSheetsService.clearRange(tokenLabel, spreadsheetId, range);
  }

  // ── Sharing ────────────────────────────────────────────────────────

  @Post('spreadsheets/:spreadsheetId/share')
  @ApiOperation({ summary: 'Share spreadsheet with a user' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiResponse({ status: 200, description: 'Spreadsheet shared' })
  async shareSpreadsheet(
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: ShareSheetDto,
  ) {
    return this.googleSheetsService.shareSpreadsheet(spreadsheetId, dto);
  }

  @Get('spreadsheets/:spreadsheetId/permissions')
  @ApiOperation({ summary: 'List sharing permissions' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async listPermissions(
    @Param('spreadsheetId') spreadsheetId: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    return this.googleSheetsService.listPermissions(tokenLabel, spreadsheetId);
  }

  @Delete('spreadsheets/:spreadsheetId/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove a sharing permission' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID to remove' })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'Permission removed' })
  async removePermission(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('permissionId') permissionId: string,
    @Query('tokenLabel') tokenLabel: string,
  ) {
    await this.googleSheetsService.removePermission(tokenLabel, spreadsheetId, permissionId);
    return { success: true, message: 'Permission removed' };
  }

  // ── Send via WhatsApp ──────────────────────────────────────────────

  @Post('spreadsheets/:spreadsheetId/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send spreadsheet via WhatsApp (as link, PDF, or Excel)' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiResponse({ status: 200, description: 'Sheet sent via WhatsApp' })
  async sendViaWhatsApp(
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: SendSheetDto,
  ) {
    const engine = this.sessionService.getEngine(dto.sessionId);
    if (!engine) {
      throw new Error(`WhatsApp session "${dto.sessionId}" is not started`);
    }

    const format = dto.format || SendFormat.LINK;

    if (format === SendFormat.LINK) {
      const info = await this.googleSheetsService.getSpreadsheet(dto.tokenLabel, spreadsheetId);
      const text = dto.caption
        ? `${dto.caption}\n\n${info.url}`
        : `📊 ${info.title}\n${info.url}`;
      const result = await engine.sendTextMessage(dto.chatId, text);
      return { messageId: result.id, format: 'link', url: info.url };
    }

    const mimeType = format === SendFormat.PDF
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const extension = format === SendFormat.PDF ? 'pdf' : 'xlsx';
    const buffer = await this.googleSheetsService.exportAsBuffer(dto.tokenLabel, spreadsheetId, mimeType);
    const info = await this.googleSheetsService.getSpreadsheet(dto.tokenLabel, spreadsheetId);
    const filename = `${info.title}.${extension}`;

    const result = await engine.sendDocumentMessage(dto.chatId, {
      data: buffer.toString('base64'),
      mimetype: mimeType,
      filename,
    });

    return { messageId: result.id, format, filename };
  }

  // ── Export / Download ──────────────────────────────────────────────

  @Get('spreadsheets/:spreadsheetId/export/:format')
  @ApiOperation({ summary: 'Export spreadsheet as PDF or Excel' })
  @ApiParam({ name: 'spreadsheetId', description: 'Google Spreadsheet ID' })
  @ApiParam({ name: 'format', description: 'Export format', enum: ['pdf', 'xlsx'] })
  @ApiQuery({ name: 'tokenLabel', required: true, description: 'Google account label' })
  @ApiResponse({ status: 200, description: 'File download' })
  async exportSpreadsheet(
    @Param('spreadsheetId') spreadsheetId: string,
    @Param('format') format: string,
    @Query('tokenLabel') tokenLabel: string,
    @Res() res: Response,
  ) {
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const buffer = await this.googleSheetsService.exportAsBuffer(tokenLabel, spreadsheetId, mimeType);
    const info = await this.googleSheetsService.getSpreadsheet(tokenLabel, spreadsheetId);
    const filename = `${info.title}.${format}`;

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
