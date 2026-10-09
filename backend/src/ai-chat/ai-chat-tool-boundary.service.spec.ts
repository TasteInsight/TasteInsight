import { AIChatService } from './ai-chat.service';
import { PromptSecurityService } from './services/prompt-security.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { UpdatePreferencesTool } from './tools/update-preferences.tool';
import { CreateMealPlanTool } from './tools/create-meal-plan.tool';
import { ContentDisplayTool } from './tools/content-display.tool';

async function* chunks(...values: any[]) {
  yield* values;
}
const call = (id: string, name: string, args: string) => ({
  type: 'tool_call',
  toolCall: { id, type: 'function', function: { name, arguments: args } },
});

describe('AIChatService actual tool boundary', () => {
  it('validates fragmented calls, feeds errors back and streams a persisted read-only preference draft', async () => {
    const profile = {
      getUserProfile: jest.fn().mockResolvedValue({
        data: { preferences: { avoidIngredients: ['香菜'] }, allergens: [] },
      }),
      updateUserProfile: jest.fn(),
    };
    const registry = new ToolRegistryService();
    registry.registerTool(new UpdatePreferencesTool(profile as any));
    const prisma = {
      aISession: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ scene: 'general_chat', messages: [] }),
      },
      aIMessage: { create: jest.fn().mockResolvedValue({ id: 'message-id' }) },
    };
    const provider = {
      setConfig: jest.fn(),
      completeChat: jest.fn().mockResolvedValue('{"suggestions":[]}'),
      streamChat: jest
        .fn()
        .mockReturnValueOnce(
          chunks(
            call(
              'invalid',
              'update_preferences',
              '{"avoidIngredients":["葱"],"userId":"other-user"}',
            ),
          ),
        )
        .mockReturnValueOnce(
          chunks(
            call('valid', 'update_', '{"avoidIngredients":'),
            call('valid', 'preferences', '["香菜","葱"]}'),
          ),
        )
        .mockReturnValueOnce(
          chunks({ type: 'text', content: '核对后点击保存即可。' }),
        ),
    };
    const service = new AIChatService(
      prisma as any,
      {
        getProviderConfig: async () => ({}),
      } as any,
      new PromptSecurityService(),
      provider as any,
      registry,
    );
    const events: any[] = await new Promise((resolve, reject) => {
      const values: any[] = [];
      service
        .streamChat('u1', 's1', { message: '请记住以后不要葱' })
        .subscribe({
          next: (value) => values.push(value),
          complete: () => resolve(values),
          error: reject,
        });
    });
    expect(provider.streamChat).toHaveBeenCalledTimes(3);
    const history = provider.streamChat.mock.calls[1][0];
    expect(
      history.some(
        (message: any) =>
          message.role === 'tool' && message.content.includes('工具参数无效'),
      ),
    ).toBe(true);
    expect(profile.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profile.getUserProfile).toHaveBeenCalledWith('u1');
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
    const block = events.find((event) => event.type === 'new_block').data;
    expect(block.type).toBe('card_preferences');
    expect(block.data[0].confirmAction.body).toEqual({
      preferences: { avoidIngredients: ['香菜', '葱'] },
    });
    const saved = prisma.aIMessage.create.mock.calls[1][0].data.content;
    expect(saved[0]).toEqual(block);
    expect(saved[1]).toEqual({ type: 'text', data: '核对后点击保存即可。' });
  });

  it('cannot bypass plan scene authorization through display_content', async () => {
    const dishes = { getDishesByIds: jest.fn() };
    const registry = new ToolRegistryService();
    const create = new CreateMealPlanTool(dishes as any, {} as any);
    const execution = jest.spyOn(create, 'execute');
    registry.registerTool(create);
    registry.registerTool(
      new ContentDisplayTool(dishes as any, {} as any, registry),
    );
    expect(
      registry.getAllTools('dish_critic').map((tool) => tool.function.name),
    ).toEqual(['display_content']);
    const body = {
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      mealTime: 'lunch',
      dishes: ['dish'],
    };
    await expect(
      registry.executeTool(
        'display_content',
        {
          type: 'meal_plan',
          data: {
            previewData: { ...body, dishes: [{ id: 'dish' }] },
            confirmAction: { api: '/meal-plans', method: 'POST', body },
          },
        },
        { userId: 'u1', sessionId: 's1', scene: 'dish_critic' },
      ),
    ).rejects.toThrow('当前对话场景不可使用');
    expect(execution).not.toHaveBeenCalled();
    expect(dishes.getDishesByIds).not.toHaveBeenCalled();
  });
});
