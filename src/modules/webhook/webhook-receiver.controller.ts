import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { createLogger } from '../../common/services/logger.service';

/**
 * Local webhook receiver endpoint.
 *
 * Register `http://localhost:2785/api/webhook-receiver` as the webhook URL
 * when creating a webhook. All events dispatched by OpenWA will be POSTed
 * here and stored in memory so you can review them via GET.
 */

interface ReceivedEvent {
  receivedAt: string;
  event: string;
  signature: string | undefined;
  payload: Record<string, unknown>;
}

// In-memory store (latest 100 events)
const receivedEvents: ReceivedEvent[] = [];
const MAX_EVENTS = 100;

@ApiTags('webhook-receiver')
@Controller('webhook-receiver')
export class WebhookReceiverController {
  private readonly logger = createLogger('WebhookReceiver');

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming webhook events (local test endpoint)' })
  @ApiResponse({ status: 200, description: 'Event received' })
  receive(
    @Body() body: Record<string, unknown>,
    @Headers('x-openwa-event') event: string,
    @Headers('x-openwa-signature') signature: string,
    @Headers('x-openwa-delivery-id') deliveryId: string,
    @Headers('x-openwa-idempotency-key') idempotencyKey: string,
  ): { status: string; deliveryId: string } {
    const entry: ReceivedEvent = {
      receivedAt: new Date().toISOString(),
      event: event || 'unknown',
      signature,
      payload: body,
    };

    receivedEvents.unshift(entry);
    if (receivedEvents.length > MAX_EVENTS) {
      receivedEvents.length = MAX_EVENTS;
    }

    this.logger.log(`Webhook received: ${event}`, {
      event,
      deliveryId,
      idempotencyKey,
      action: 'webhook_received',
    });

    // Log payload to console for easy viewing
    console.log('\n========== WEBHOOK EVENT RECEIVED ==========');
    console.log(`Event:        ${event}`);
    console.log(`Delivery ID:  ${deliveryId}`);
    console.log(`Idempotency:  ${idempotencyKey}`);
    console.log(`Signature:    ${signature || 'none'}`);
    console.log(`Payload:      ${JSON.stringify(body, null, 2)}`);
    console.log('=============================================\n');

    return { status: 'received', deliveryId };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'View received webhook events (latest 100)' })
  @ApiResponse({ status: 200, description: 'List of received events' })
  list(): { total: number; events: ReceivedEvent[] } {
    return {
      total: receivedEvents.length,
      events: receivedEvents,
    };
  }

  @Post('clear')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all received webhook events' })
  @ApiResponse({ status: 200, description: 'Events cleared' })
  clear(): { status: string } {
    receivedEvents.length = 0;
    return { status: 'cleared' };
  }
}
