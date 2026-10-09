import { AIChatService } from './ai-chat.service';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('AIChatService follow-up lifecycle', () => {
  let service: AIChatService;
  let provider: any;
  let prisma: any;
  let events: any[];

  beforeEach(() => {
    events = [];
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
      },
    };
    provider = {
      setConfig: jest.fn(),
      streamChat: jest.fn(async function* () {
        yield { type: 'text', content: '第二食堂的香菇鸡肉饭比较清淡。' };
      }),
      completeChat: jest
        .fn()
        .mockResolvedValue(
          '{"suggestions":["香菇鸡肉饭在哪个窗口？","还有素食选择吗？"]}',
        ),
    };
    service = new AIChatService(
      prisma,
      { getProviderConfig: async () => ({}) } as any,
      {
        validateUserInput: (text: string) => ({
          isValid: true,
          sanitized: text,
        }),
        enhanceSystemPrompt: (text: string) => text,
        filterAIResponse: (text: string) => text,
      } as any,
      provider,
      { getAllTools: () => [] } as any,
    );
  });

  const collect = (service: AIChatService, events: any[]) =>
    new Promise<void>((resolve, reject) => {
      service.streamChat('u1', 's1', { message: '午餐想吃清淡的' }).subscribe({
        next: (e) => events.push(e),
        complete: resolve,
        error: reject,
      });
    });

  it('persists and releases the answer before generating questions from that answer', async () => {
    let finish!: (value: string) => void;
    provider.completeChat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const completed = collect(service, events);
    await flush();
    expect(events.at(-1)).toEqual({
      type: 'reply_complete',
      data: { messageId: 'reply-1' },
    });
    expect(prisma.aIMessage.create).toHaveBeenCalledTimes(2);
    expect(provider.completeChat.mock.calls[0][0][1].content).toContain(
      '香菇鸡肉饭',
    );
    expect(provider.completeChat.mock.calls[0][0][1].content).toContain(
      '午餐想吃清淡的',
    );
    finish('{"suggestions":["在哪个窗口？"]}');
    await completed;
    expect(events.at(-1)).toEqual({
      type: 'suggestions',
      data: { suggestions: ['在哪个窗口？'] },
    });
  });

  it.each(['timeout', 'invalid-json'])(
    'does not fail a completed answer when follow-ups fail: %s',
    async (failure) => {
      if (failure === 'timeout')
        provider.completeChat.mockRejectedValueOnce(new Error('timeout'));
      else provider.completeChat.mockResolvedValueOnce('invalid');
      await collect(service, events);
      expect(events.map((event) => event.type)).toEqual([
        'message_received',
        'text_chunk',
        'reply_complete',
      ]);
    },
  );

  it('cancels pending follow-up work when the client disconnects', async () => {
    let signal: AbortSignal | undefined;
    provider.completeChat.mockImplementationOnce(
      (_messages: unknown, pendingSignal: AbortSignal) => {
        signal = pendingSignal;
        return new Promise((_resolve, reject) =>
          signal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          ),
        );
      },
    );
    const subscription = service
      .streamChat('u1', 's1', { message: '午餐' })
      .subscribe((e) => events.push(e));
    await flush();
    expect(signal?.aborted).toBe(false);
    subscription.unsubscribe();
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(events.some((event) => event.type === 'suggestions')).toBe(false);
  });

  it('does not generate follow-ups for a failed answer', async () => {
    provider.streamChat.mockImplementationOnce(async function* () {
      yield { type: 'error', error: 'provider failed' };
    });
    await collect(service, events);
    expect(provider.completeChat).not.toHaveBeenCalled();
    expect(events.at(-1).type).toBe('error');
  });

  it('retains card references when answering a selected follow-up in the next round', async () => {
    prisma.aISession.findFirst.mockResolvedValueOnce({
      id: 's1',
      scene: 'general_chat',
      messages: [
        { role: 'user', content: [{ type: 'text', data: '推荐两道清淡的菜' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'card_dish',
              data: [
                {
                  dish: { name: '香菇鸡肉饭' },
                  canteenName: '第二食堂',
                  windowName: '家常菜窗口',
                },
                {
                  dish: { name: '清炒时蔬' },
                  canteenName: '第二食堂',
                  windowName: '素食窗口',
                },
              ],
            },
          ],
        },
      ],
    });
    await new Promise<void>((resolve) =>
      service
        .streamChat('u1', 's1', { message: '这两道菜分别在哪个窗口？' })
        .subscribe({ complete: resolve }),
    );
    const history = provider.streamChat.mock.calls[0][0];
    expect(
      history.find((message: any) => message.role === 'assistant').content,
    ).toContain('家常菜窗口');
    expect(
      history.find((message: any) => message.role === 'assistant').content,
    ).toContain('清炒时蔬');
    expect(history.at(-1).content).toBe('这两道菜分别在哪个窗口？');
  });
});
