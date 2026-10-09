import { AIChatService } from './ai-chat.service';
import { PromptSecurityService } from './services/prompt-security.service';
import { StreamChunk } from './services/ai-provider/base-ai-provider.interface';

async function* stream(chunks: StreamChunk[]) {
  yield* chunks;
}

const call = (
  id: string,
  name = 'display_content',
  args = '{"type":"dish","ids":["dish-1"]}',
): StreamChunk => ({
  type: 'tool_call',
  toolCall: { id, type: 'function', function: { name, arguments: args } },
});

describe('AIChatService generated answer contracts', () => {
  let service: AIChatService;
  let prisma: any;
  let provider: any;
  let registry: any;

  beforeEach(() => {
    prisma = {
      aISession: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 's1', scene: 'general_chat', messages: [] }),
      },
      aIMessage: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'user-1' })
          .mockResolvedValue({ id: 'reply-1' }),
        findMany: jest.fn(),
      },
    };
    provider = {
      setConfig: jest.fn(),
      streamChat: jest.fn(),
      completeChat: jest.fn().mockResolvedValue('{"suggestions":[]}'),
    };
    registry = {
      getAllTools: () => [
        {
          type: 'function',
          function: { name: 'display_content', parameters: {} },
        },
      ],
      executeTool: jest
        .fn()
        .mockResolvedValue([
          { dish: { id: 'dish-1', name: '鸡肉饭' }, canteenName: '第二食堂' },
        ]),
    };
    service = new AIChatService(
      prisma,
      { getProviderConfig: async () => ({}) } as any,
      new PromptSecurityService(),
      provider,
      registry,
    );
  });

  const collect = (service: AIChatService) =>
    new Promise<any[]>((resolve, reject) => {
      const events: any[] = [];
      service.streamChat('u1', 's1', { message: '推荐午餐' }).subscribe({
        next: (event) => events.push(event),
        complete: () => resolve(events),
        error: reject,
      });
    });

  it('stores exactly the streamed text/card sequence, including a held suffix before a card', async () => {
    provider.streamChat
      .mockReturnValueOnce(
        stream([{ type: 'text', content: 'Lunch options' }, call('c1')]),
      )
      .mockReturnValueOnce(
        stream([{ type: 'text', content: '再看第二个选择。' }, call('c2')]),
      )
      .mockReturnValueOnce(
        stream([{ type: 'text', content: '任选一个食堂即可。' }]),
      );

    const events = await collect(service);
    const streamed: any[] = [];
    for (const event of events) {
      if (event.type === 'text_chunk') {
        const last = streamed.at(-1);
        if (last?.type === 'text') last.data += event.data;
        else streamed.push({ type: 'text', data: event.data });
      } else if (event.type === 'new_block') streamed.push(event.data);
    }
    expect(streamed.map((segment) => segment.type)).toEqual([
      'text',
      'card_dish',
      'text',
      'card_dish',
      'text',
    ]);
    expect(streamed[0].data).toBe('Lunch options');
    const saved = prisma.aIMessage.create.mock.calls[1][0].data.content;
    expect(saved).toEqual(streamed);
    prisma.aIMessage.findMany.mockResolvedValue([
      { role: 'assistant', content: saved, createdAt: new Date('2026-10-04') },
    ]);
    expect((await service.getHistory('u1', 's1')).messages[0].content).toEqual(
      streamed,
    );
  });

  it('persists the same sensitive-value redaction that is streamed', async () => {
    provider.streamChat.mockReturnValueOnce(
      stream([
        { type: 'text', content: '午餐建议。api_' },
        { type: 'text', content: 'key = private-value' },
        { type: 'text', content: ' 继续选菜。' },
      ]),
    );
    const events = await collect(service);
    const text = events
      .filter((event) => event.type === 'text_chunk')
      .map((event) => event.data)
      .join('');
    expect(text).toBe('午餐建议。[REDACTED] 继续选菜。');
    expect(prisma.aIMessage.create.mock.calls[1][0].data.content).toEqual([
      { type: 'text', data: text },
    ]);
  });

  it('assembles function-name fragments before executing a tool', async () => {
    provider.streamChat
      .mockReturnValueOnce(
        stream([call('c1', 'display_', ''), call('c1', 'content')]),
      )
      .mockReturnValueOnce(
        stream([{ type: 'text', content: '午餐建议已准备好。' }]),
      );
    await collect(service);
    expect(registry.executeTool).toHaveBeenCalledWith(
      'display_content',
      { type: 'dish', ids: ['dish-1'] },
      expect.any(Object),
    );
    const history = provider.streamChat.mock.calls[1][0];
    expect(
      history.find((message: any) => message.tool_calls)?.tool_calls[0].function
        .name,
    ).toBe('display_content');
  });

  it('does not append a failure warning when the tenth turn is a completed answer', async () => {
    let turn = 0;
    provider.streamChat.mockImplementation(() => {
      turn++;
      return stream(
        turn < 10
          ? [call(`c${turn}`)]
          : [{ type: 'text', content: '选择第二食堂的鸡肉饭即可。' }],
      );
    });
    const events = await collect(service);
    expect(provider.streamChat).toHaveBeenCalledTimes(10);
    expect(
      events
        .filter((event) => event.type === 'text_chunk')
        .map((event) => event.data)
        .join(''),
    ).toBe('选择第二食堂的鸡肉饭即可。');
    expect(events.at(-1)).toEqual({
      type: 'reply_complete',
      data: { messageId: 'reply-1' },
    });
    expect(provider.completeChat).toHaveBeenCalledTimes(1);
  });

  it('uses one final tool-disabled synthesis after exhausting tool turns, then persists before follow-ups', async () => {
    let turn = 0;
    provider.streamChat.mockImplementation(
      (_messages: unknown, tools: unknown[]) => {
        turn++;
        return stream(
          tools.length
            ? [call(`c${turn}`)]
            : [
                {
                  type: 'text',
                  content:
                    '已查到第二食堂的鸡肉饭；其他食堂暂时没有符合条件的结果。',
                },
              ],
        );
      },
    );
    provider.completeChat.mockImplementation(async () => {
      expect(prisma.aIMessage.create).toHaveBeenCalledTimes(2);
      return '{"suggestions":["鸡肉饭多少钱？"]}';
    });
    const events = await collect(service);
    expect(registry.executeTool).toHaveBeenCalledTimes(10);
    expect(provider.streamChat).toHaveBeenCalledTimes(11);
    expect(provider.streamChat.mock.calls.at(-1)[1]).toEqual([]);
    expect(events.at(-2)).toEqual({
      type: 'reply_complete',
      data: { messageId: 'reply-1' },
    });
    expect(events.at(-1).type).toBe('suggestions');
    expect(
      events
        .filter((event) => event.type === 'text_chunk')
        .map((event) => event.data)
        .join(''),
    ).toBe('已查到第二食堂的鸡肉饭；其他食堂暂时没有符合条件的结果。');
  });

  it('cancels the final synthesis without saving an incomplete assistant or generating follow-ups', async () => {
    let signal!: AbortSignal;
    let started!: () => void;
    const finalStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let turn = 0;
    provider.streamChat.mockImplementation(async function* (
      _messages: unknown,
      tools: unknown[],
      pendingSignal: AbortSignal,
    ) {
      if (tools.length) yield call(`c${++turn}`);
      else {
        signal = pendingSignal;
        started();
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
      }
    });
    const events: any[] = [];
    const subscription = service
      .streamChat('u1', 's1', { message: '推荐午餐' })
      .subscribe((event) => events.push(event));
    await finalStarted;
    subscription.unsubscribe();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(signal.aborted).toBe(true);
    expect(prisma.aIMessage.create).toHaveBeenCalledTimes(1);
    expect(provider.completeChat).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'reply_complete')).toBe(false);
  });
});
