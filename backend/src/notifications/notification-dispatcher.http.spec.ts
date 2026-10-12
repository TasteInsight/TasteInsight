import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { createServer, IncomingHttpHeaders, Server } from 'http';
import { AddressInfo } from 'net';
import { NotificationDispatcher } from './notification-dispatcher.service';

describe('notification webhook HTTP contract', () => {
  const secret = 'http-contract-signing-secret-32-characters';
  let server: Server;
  let url: string;
  let dispatcher: NotificationDispatcher;
  let row: any;
  let responseStatus: number;
  let requests: Array<{ headers: IncomingHttpHeaders; body: string }>;
  let originalNoProxy: string | undefined;

  beforeEach(async () => {
    requests = [];
    responseStatus = 503;
    originalNoProxy = process.env.NO_PROXY;
    process.env.NO_PROXY = '127.0.0.1';
    server = createServer((request, response) => {
      const parts: Buffer[] = [];
      request.on('data', (part) => parts.push(Buffer.from(part)));
      request.on('end', () => {
        requests.push({
          headers: request.headers,
          body: Buffer.concat(parts).toString('utf8'),
        });
        response.writeHead(responseStatus);
        response.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications`;
    row = {
      id: 'outbox',
      notificationId: 'event',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(0),
      lockedUntil: null,
    };
    const prisma: any = {
      notificationOutbox: {
        findMany: async () =>
          row.status === 'pending' && row.nextAttemptAt <= new Date()
            ? [{ ...row }]
            : [],
        updateMany: async ({ where, data }) => {
          if (where.attempts !== undefined && row.attempts !== where.attempts)
            return { count: 0 };
          if (where.status && row.status !== where.status) return { count: 0 };
          if (
            where.lockedUntil &&
            row.lockedUntil?.getTime() !== where.lockedUntil.getTime()
          )
            return { count: 0 };
          const attempts = data.attempts?.increment
            ? row.attempts + data.attempts.increment
            : row.attempts;
          Object.assign(row, data, { attempts });
          return { count: 1 };
        },
      },
      notification: {
        findUnique: async () => ({
          id: 'event',
          userId: 'recipient',
          actor: null,
          type: 'new_dish',
          targetType: 'dish',
          targetId: 'dish',
          rootId: null,
          withdrawnAt: null,
          createdAt: new Date('2026-10-09T00:00:00Z'),
        }),
      },
    };
    dispatcher = new NotificationDispatcher(
      prisma,
      {
        webhookUrl: () => url,
        canDeliver: async () => true,
      } as any,
      new ConfigService({
        NODE_ENV: 'test',
        NOTIFICATION_WEBHOOK_SECRET: secret,
        NOTIFICATION_WEBHOOK_BACKOFF_MS: 100,
      }),
    );
  });

  afterEach(async () => {
    dispatcher.onModuleDestroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (originalNoProxy === undefined) delete process.env.NO_PROXY;
    else process.env.NO_PROXY = originalNoProxy;
  });

  it('sends a signed JSON event, persists 503 retry, and keeps one receiver idempotency key', async () => {
    await dispatcher.dispatchDue();
    expect(row).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'http_503',
      lockedUntil: null,
    });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(requests).toHaveLength(1);
    expect(requests[0].headers['idempotency-key']).toBe('event');
    expect(requests[0].headers['x-tasteinsight-signature']).toBe(
      `sha256=${createHmac('sha256', secret).update(requests[0].body).digest('hex')}`,
    );
    expect(JSON.parse(requests[0].body)).toEqual({
      eventId: 'event',
      recipientId: 'recipient',
      actor: null,
      type: 'new_dish',
      target: { type: 'dish', id: 'dish', rootId: null },
      createdAt: '2026-10-09T00:00:00.000Z',
    });
    responseStatus = 204;
    row.nextAttemptAt = new Date(0);
    await dispatcher.dispatchDue();
    expect(row).toMatchObject({
      status: 'delivered',
      attempts: 2,
      lastError: null,
    });
    expect(requests).toHaveLength(2);
    expect(requests[1].headers['idempotency-key']).toBe(
      requests[0].headers['idempotency-key'],
    );
    expect(requests[1].body).toBe(requests[0].body);
  });

  it('stops real HTTP retries on permanent rejection', async () => {
    responseStatus = 400;
    await dispatcher.dispatchDue();
    expect(row).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'http_400',
    });
    await dispatcher.dispatchDue();
    expect(requests).toHaveLength(1);
  });
});
