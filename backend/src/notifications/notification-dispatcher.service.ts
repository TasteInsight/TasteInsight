import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationOutbox, Prisma } from '@prisma/client';
import axios from 'axios';
import { createHmac } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { NotificationService } from './notification.service';
import { notificationWebhookConfiguration } from './notification-webhook.config';

@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private timer?: ReturnType<typeof setInterval>;
  private activeRun?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const settings = this.configuration();
    if (!settings.url || this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => {
      void this.dispatchDue().catch(() =>
        this.logger.error('Notification outbox dispatch failed'),
      );
    }, settings.pollMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.activeRun?.catch(() => undefined);
  }

  private configuration() {
    return notificationWebhookConfiguration((key) =>
      key === 'NOTIFICATION_WEBHOOK_URL'
        ? this.notifications.webhookUrl()
        : this.config.get(key),
    );
  }

  async dispatchDue(): Promise<void> {
    if (this.activeRun || this.stopping) return;
    const settings = this.configuration();
    if (!settings.url) return;
    this.activeRun = this.runDispatch(settings);
    try {
      await this.activeRun;
    } finally {
      this.activeRun = undefined;
    }
  }

  private async runDispatch(
    settings: ReturnType<typeof notificationWebhookConfiguration>,
  ): Promise<void> {
    const now = new Date();
    const rows = await this.prisma.notificationOutbox.findMany({
      where: {
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', lockedUntil: { lte: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    for (const row of rows) {
      if (this.stopping) break;
      await this.deliver(row, settings);
    }
  }

  private async deliver(
    row: NotificationOutbox,
    settings: ReturnType<typeof notificationWebhookConfiguration>,
  ): Promise<void> {
    const timeout = settings.timeoutMs;
    const maxAttempts = settings.maxAttempts;
    const now = new Date();
    const lockedUntil = new Date(
      now.getTime() + Math.max(30000, timeout * 2 + 1000),
    );
    const claimed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id: row.id,
        attempts: row.attempts,
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', lockedUntil: { lte: now } },
        ],
      },
      data: { status: 'processing', lockedUntil, attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const claim = { id: row.id, status: 'processing', lockedUntil };
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: row.notificationId },
        include: {
          actor: { select: { id: true, nickname: true, avatar: true } },
        },
      });
      if (
        !notification ||
        notification.withdrawnAt ||
        !(await this.notifications.canDeliver(this.prisma, notification))
      ) {
        await this.prisma.notificationOutbox.updateMany({
          where: claim,
          data: { status: 'cancelled', lockedUntil: null },
        });
        return;
      }
      if (row.attempts >= maxAttempts) {
        await this.prisma.notificationOutbox.updateMany({
          where: claim,
          data: {
            status: 'failed',
            lockedUntil: null,
            lastError: 'retry_limit',
          },
        });
        return;
      }
      const body = JSON.stringify({
        eventId: notification.id,
        recipientId: notification.userId,
        type: notification.type,
        actor: notification.actor,
        target: {
          type: notification.targetType,
          id: notification.targetId,
          rootId: notification.rootId,
        },
        createdAt: notification.createdAt.toISOString(),
      });
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': notification.id,
        'X-TasteInsight-Signature': `sha256=${createHmac('sha256', settings.secret).update(body).digest('hex')}`,
      };
      await axios.post(settings.url, body, {
        headers,
        timeout,
        maxRedirects: 0,
        maxContentLength: 65536,
      });
      await this.prisma.notificationOutbox.updateMany({
        where: claim,
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          lockedUntil: null,
          lastError: null,
        },
      });
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      const retryable =
        status === undefined ||
        status === 408 ||
        status === 429 ||
        status >= 500;
      const attempt = row.attempts + 1;
      const delay = Math.min(3600000, settings.backoffMs * 2 ** (attempt - 1));
      const data: Prisma.NotificationOutboxUpdateManyMutationInput = {
        status: retryable && attempt < maxAttempts ? 'pending' : 'failed',
        lockedUntil: null,
        nextAttemptAt: new Date(Date.now() + delay),
        lastError: status ? `http_${status}` : 'delivery_failed',
      };
      await this.prisma.notificationOutbox.updateMany({ where: claim, data });
    }
  }
}
