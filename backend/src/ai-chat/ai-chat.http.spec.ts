import { INestApplication, MessageEvent } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import { Observable, Subscriber } from 'rxjs';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AIChatController } from './ai-chat.controller';
import { AIChatService } from './ai-chat.service';

describe('AI chat HTTP stream lifecycle', () => {
  let app: INestApplication;
  let subscriber: Subscriber<MessageEvent>;
  const teardown = jest.fn();
  const service = {
    streamChat: jest.fn(
      () =>
        new Observable<MessageEvent>((sink) => {
          subscriber = sink;
          sink.next({ type: 'text_chunk', data: '午餐' });
          return teardown;
        }),
    ),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AIChatController],
      providers: [{ provide: AIChatService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { sub: 'test-user' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => subscriber?.complete());

  async function openStream() {
    const url = `${await app.getUrl()}/ai/sessions/test-session/chat/stream`;
    return new Promise<{
      close: () => void;
      done: Promise<string>;
    }>((resolve, reject) => {
      const req = httpRequest(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          let text = '';
          let ready = false;
          const done = new Promise<string>((finish) => {
            res.on('end', () => finish(text));
          });
          res.on('data', (chunk: Buffer) => {
            text += chunk.toString();
            if (!ready && text.includes('data: 午餐')) {
              ready = true;
              resolve({ close: () => req.destroy(), done });
            }
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify({ message: '午餐吃什么？' }));
    });
  }

  it('unsubscribes when the client closes a POST response after its body was parsed', async () => {
    const stream = await openStream();
    const closed = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 500);
      teardown.mockImplementationOnce(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
    stream.close();
    expect(await closed).toBe(true);
    expect(subscriber.closed).toBe(true);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('delivers completion and accepts a subsequent stream', async () => {
    for (let index = 0; index < 2; index++) {
      const stream = await openStream();
      subscriber.next({ type: 'reply_complete', data: { messageId: 'reply' } });
      subscriber.complete();
      expect(await stream.done).toContain('event: reply_complete');
    }
    expect(teardown).toHaveBeenCalledTimes(2);
  });
});
