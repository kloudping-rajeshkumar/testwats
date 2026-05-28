import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { ContactService } from './contact.service';

@ApiTags('contacts')
@Controller('sessions/:sessionId/contacts')
export class ContactController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly contactService: ContactService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all saved contacts for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  async findAll(@Param('sessionId') sessionId: string) {
    return this.contactService.findAllBySession(sessionId);
  }

  @Get('map')
  @ApiOperation({ summary: 'Get contact map (chatId -> contact) for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Contact map' })
  async getMap(@Param('sessionId') sessionId: string) {
    return this.contactService.getContactMap(sessionId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new contact or update existing' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 201, description: 'Contact saved' })
  async saveContact(
    @Param('sessionId') sessionId: string,
    @Body() body: { chatId: string; name: string; phone?: string },
  ) {
    return this.contactService.saveContact(sessionId, body.chatId, body.name, body.phone);
  }

  @Get(':contactId')
  @ApiOperation({ summary: 'Get a specific contact by chat ID' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Contact details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const contact = await this.contactService.findByChatId(sessionId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    return contact;
  }

  @Put(':contactId/name')
  @ApiOperation({ summary: 'Update contact display name' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  async updateName(
    @Param('sessionId') sessionId: string,
    @Param('contactId') contactId: string,
    @Body() body: { name: string },
  ) {
    const contact = await this.contactService.updateName(sessionId, contactId, body.name);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    return contact;
  }

  @Get('check/:number')
  @ApiOperation({ summary: 'Check if a phone number exists on WhatsApp' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'number', description: 'Phone number to check (e.g., 628123456789)' })
  @ApiResponse({ status: 200, description: 'Number existence check result' })
  async checkNumber(@Param('sessionId') sessionId: string, @Param('number') number: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    const exists = await engine.checkNumberExists(number);
    return {
      number,
      exists,
      whatsappId: exists ? `${number}@c.us` : null,
    };
  }

  @Get(':contactId/profile-picture')
  @ApiOperation({ summary: 'Get profile picture URL for a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Profile picture URL' })
  async getProfilePicture(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    const url = await engine.getProfilePicture(contactId);
    return { url };
  }

  @Post(':contactId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Contact blocked' })
  async blockContact(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    await engine.blockContact(contactId);
    return { success: true, message: 'Contact blocked' };
  }

  @Delete(':contactId/block')
  @ApiOperation({ summary: 'Unblock a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Contact unblocked' })
  async unblockContact(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    await engine.unblockContact(contactId);
    return { success: true, message: 'Contact unblocked' };
  }
}
