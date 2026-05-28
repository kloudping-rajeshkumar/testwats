import { Injectable, OnModuleInit, OnModuleDestroy, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ScheduledMessage, ScheduleStatus } from './entities/scheduled-message.entity';
import { MessageService } from '../message/message.service';
import { createLogger } from '../../common/services/logger.service';

const logger = createLogger('ScheduleService');

@Injectable()
export class ScheduleService implements OnModuleInit, OnModuleDestroy {
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ScheduledMessage, 'data')
    private readonly scheduledMessageRepository: Repository<ScheduledMessage>,
    private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    // Check every 30 seconds for pending messages
    this.intervalRef = setInterval(() => {
      void this.processPending();
    }, 30_000);
    // Also run once on startup
    void this.processPending();
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  /**
   * Create a new scheduled message
   */
  async create(data: {
    sessionId: string;
    chatId: string;
    message: string;
    scheduledAt: Date;
  }): Promise<ScheduledMessage> {
    const scheduledAt = new Date(data.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const entity = this.scheduledMessageRepository.create({
      sessionId: data.sessionId,
      chatId: data.chatId,
      message: data.message,
      scheduledAt,
      status: ScheduleStatus.PENDING,
    });

    return this.scheduledMessageRepository.save(entity);
  }

  /**
   * List all scheduled messages, optionally filtered by sessionId
   */
  async findAll(sessionId?: string): Promise<ScheduledMessage[]> {
    const where = sessionId ? { sessionId } : {};
    return this.scheduledMessageRepository.find({
      where,
      order: { scheduledAt: 'ASC' },
    });
  }

  /**
   * Get a single scheduled message by ID
   */
  async findOne(id: string): Promise<ScheduledMessage> {
    const msg = await this.scheduledMessageRepository.findOne({ where: { id } });
    if (!msg) {
      throw new NotFoundException(`Scheduled message ${id} not found`);
    }
    return msg;
  }

  /**
   * Cancel a pending scheduled message
   */
  async cancel(id: string): Promise<ScheduledMessage> {
    const msg = await this.findOne(id);
    if (msg.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel a message with status '${msg.status}'`);
    }
    msg.status = ScheduleStatus.CANCELLED;
    return this.scheduledMessageRepository.save(msg);
  }

  /**
   * Update a pending scheduled message
   */
  async update(
    id: string,
    data: Partial<{ chatId: string; message: string; scheduledAt: Date }>,
  ): Promise<ScheduledMessage> {
    const msg = await this.findOne(id);
    if (msg.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException(`Cannot update a message with status '${msg.status}'`);
    }

    if (data.scheduledAt !== undefined) {
      const scheduledAt = new Date(data.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Invalid scheduledAt date');
      }
      msg.scheduledAt = scheduledAt;
    }
    if (data.chatId !== undefined) {
      msg.chatId = data.chatId;
    }
    if (data.message !== undefined) {
      msg.message = data.message;
    }

    return this.scheduledMessageRepository.save(msg);
  }

  /**
   * Process all pending messages whose scheduledAt time has arrived.
   * Called every 30 seconds by the internal interval.
   */
  async processPending(): Promise<void> {
    let pending: ScheduledMessage[];
    try {
      pending = await this.scheduledMessageRepository.find({
        where: {
          status: ScheduleStatus.PENDING,
          scheduledAt: LessThanOrEqual(new Date()),
        },
      });
    } catch (error) {
      logger.error('Failed to query pending scheduled messages', error);
      return;
    }

    if (pending.length === 0) return;

    logger.log(`Processing ${pending.length} pending scheduled message(s)`);

    for (const msg of pending) {
      try {
        await this.messageService.sendText(msg.sessionId, {
          chatId: msg.chatId,
          text: msg.message,
        });
        msg.status = ScheduleStatus.SENT;
        msg.sentAt = new Date();
        await this.scheduledMessageRepository.save(msg);
        logger.log(`Scheduled message ${msg.id} sent successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        msg.status = ScheduleStatus.FAILED;
        msg.errorMessage = errorMessage;
        await this.scheduledMessageRepository.save(msg);
        logger.error(`Failed to send scheduled message ${msg.id}: ${errorMessage}`);
      }
    }
  }
}
