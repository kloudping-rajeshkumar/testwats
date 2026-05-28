import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { ScheduledMessage } from './entities/scheduled-message.entity';

@ApiTags('scheduled-messages')
@Controller('scheduled-messages')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled message' })
  @ApiResponse({ status: 201, description: 'Scheduled message created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @Body() body: { sessionId: string; chatId: string; message: string; scheduledAt: string },
  ): Promise<ScheduledMessage> {
    return this.scheduleService.create({
      sessionId: body.sessionId,
      chatId: body.chatId,
      message: body.message,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all scheduled messages' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiResponse({ status: 200, description: 'List of scheduled messages' })
  async findAll(@Query('sessionId') sessionId?: string): Promise<ScheduledMessage[]> {
    return this.scheduleService.findAll(sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled message by ID' })
  @ApiResponse({ status: 200, description: 'Scheduled message details' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  async findOne(@Param('id') id: string): Promise<ScheduledMessage> {
    return this.scheduleService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a pending scheduled message' })
  @ApiResponse({ status: 200, description: 'Scheduled message updated' })
  @ApiResponse({ status: 400, description: 'Cannot update non-pending message' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  async update(
    @Param('id') id: string,
    @Body() body: { chatId?: string; message?: string; scheduledAt?: string },
  ): Promise<ScheduledMessage> {
    return this.scheduleService.update(id, {
      chatId: body.chatId,
      message: body.message,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending scheduled message' })
  @ApiResponse({ status: 200, description: 'Scheduled message cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel non-pending message' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  async cancel(@Param('id') id: string): Promise<ScheduledMessage> {
    return this.scheduleService.cancel(id);
  }
}
