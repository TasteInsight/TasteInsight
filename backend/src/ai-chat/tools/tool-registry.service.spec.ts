import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { BaseTool } from '../tools/base-tool.interface';

class MockTool implements BaseTool {
  getDefinition() {
    return {
      name: 'mock_tool',
      description: 'A mock tool for testing',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
    };
  }

  async execute(params: any, context: any) {
    return { result: `Executed with ${params.input}` };
  }
}

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
  let mockTool: MockTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
    mockTool = new MockTool();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      service.registerTool(mockTool);
      expect(service.hasTool('mock_tool')).toBe(true);
    });

    it('should not register duplicate tools', () => {
      service.registerTool(mockTool);
      service.registerTool(mockTool);

      const tools = service.getAllTools();
      const mockTools = tools.filter((t) => t.function.name === 'mock_tool');
      expect(mockTools.length).toBe(1);
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tools', () => {
      service.registerTool(mockTool);
      expect(service.hasTool('mock_tool')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      expect(service.hasTool('nonexistent_tool')).toBe(false);
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tools in correct format', () => {
      service.registerTool(mockTool);
      const tools = service.getAllTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toHaveProperty('type', 'function');
      expect(tools[0].function).toHaveProperty('name', 'mock_tool');
      expect(tools[0].function).toHaveProperty('description');
      expect(tools[0].function).toHaveProperty('parameters');
    });

    it('should return empty array when no tools registered', () => {
      const tools = service.getAllTools();
      expect(tools).toEqual([]);
    });
  });

  describe('executeTool', () => {
    it('should execute registered tool with correct parameters', async () => {
      service.registerTool(mockTool);

      const result = await service.executeTool(
        'mock_tool',
        { input: 'test' },
        { userId: 'user1', sessionId: 'session1' },
      );

      expect(result).toEqual({ result: 'Executed with test' });
    });

    it('should throw error for unregistered tool', async () => {
      await expect(
        service.executeTool(
          'nonexistent_tool',
          {},
          { userId: 'user1', sessionId: 'session1' },
        ),
      ).rejects.toThrow('工具未找到: nonexistent_tool');
    });

    it('should pass context to tool execution', async () => {
      const contextSpy = jest.spyOn(mockTool, 'execute');
      service.registerTool(mockTool);

      const context = {
        userId: 'user123',
        sessionId: 'session456',
        localTime: '2025-01-01T12:00:00Z',
      };

      await service.executeTool('mock_tool', { input: 'test' }, context);

      expect(contextSpy).toHaveBeenCalledWith({ input: 'test' }, context);
    });

    it.each([
      ['missing required input', {}],
      ['incorrect field type', { input: 123 }],
      ['unknown input field', { input: 'test', userId: 'another-user' }],
      ['array instead of an object', []],
    ])('rejects %s before invoking the tool', async (_label, params) => {
      jest.spyOn(mockTool, 'getDefinition').mockReturnValue({
        name: 'mock_tool',
        description: 'Validated tool',
        parameters: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
      } as any);
      const execution = jest.spyOn(mockTool, 'execute');
      service.registerTool(mockTool);

      await expect(
        service.executeTool('mock_tool', params, {
          userId: 'user1',
          sessionId: 'session1',
        }),
      ).rejects.toThrow('工具参数无效');
      expect(execution).not.toHaveBeenCalled();
    });

    it('enforces numeric bounds and enums without converting input', async () => {
      jest.spyOn(mockTool, 'getDefinition').mockReturnValue({
        name: 'mock_tool',
        description: 'Bounded tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', enum: ['allowed'] },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
          required: ['input'],
        },
      } as any);
      const execution = jest.spyOn(mockTool, 'execute');
      service.registerTool(mockTool);
      for (const params of [
        { input: 'disallowed' },
        { input: 'allowed', limit: '5' },
        { input: 'allowed', limit: 1.5 },
        { input: 'allowed', limit: 101 },
      ]) {
        await expect(
          service.executeTool('mock_tool', params, {
            userId: 'user1',
            sessionId: 'session1',
          }),
        ).rejects.toThrow('工具参数无效');
      }
      expect(execution).not.toHaveBeenCalled();
    });

    it('uses the same scene policy for advertised tools and execution', async () => {
      const definition = mockTool.getDefinition();
      jest.spyOn(mockTool, 'getDefinition').mockReturnValue({
        ...definition,
        scenes: ['general_chat', 'meal_planner'],
      } as any);
      const execution = jest.spyOn(mockTool, 'execute');
      service.registerTool(mockTool);

      expect((service as any).getAllTools('dish_critic')).toEqual([]);
      expect((service as any).getAllTools('meal_planner')).toHaveLength(1);
      await expect(
        service.executeTool('mock_tool', { input: 'test' }, {
          userId: 'user1',
          sessionId: 'session1',
          scene: 'dish_critic',
        } as any),
      ).rejects.toThrow('当前对话场景不可使用');
      expect(execution).not.toHaveBeenCalled();
      await expect(
        service.executeTool('mock_tool', { input: 'test' }, {
          userId: 'user1',
          sessionId: 'session1',
          scene: 'meal_planner',
        } as any),
      ).resolves.toEqual({ result: 'Executed with test' });
    });
  });
});
