import { Test, TestingModule } from '@nestjs/testing';
import { CanteenInfoTool } from './canteen-info.tool';
import { CanteensService } from '@/canteens/canteens.service';

const mockCanteensService = {
  getCanteenById: jest.fn(),
  getCanteens: jest.fn(),
};

describe('CanteenInfoTool', () => {
  let tool: CanteenInfoTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanteenInfoTool,
        {
          provide: CanteensService,
          useValue: mockCanteensService,
        },
      ],
    }).compile();

    tool = module.get<CanteenInfoTool>(CanteenInfoTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('get_canteen_info');
      expect(definition.description).toContain('获取食堂信息');
      expect(definition.parameters.properties).toHaveProperty('canteenId');
    });

    it('should have optional canteenId parameter', () => {
      const definition = tool.getDefinition();

      // canteenId should not be in required array (or required should be undefined)
      expect(definition.parameters.required).toBeUndefined();
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    const mockCanteens = [
      {
        id: 'canteen-1',
        name: '紫荆园',
        description: '紫荆园食堂',
        openingHours: '07:00-22:00',
        averageRating: 4.2,
      },
      {
        id: 'canteen-2',
        name: '桃李园',
        description: '桃李园食堂',
        openingHours: '06:30-21:30',
        averageRating: 4.5,
      },
    ];

    it('should return all canteens when canteenId is not provided', async () => {
      mockCanteensService.getCanteens.mockResolvedValue({
        data: { items: mockCanteens },
      });

      const result = await tool.execute({}, mockContext);

      expect(mockCanteensService.getCanteens).toHaveBeenCalledWith(1, 100);
      expect(result).toEqual(mockCanteens);
    });

    it('should return specific canteen when canteenId is provided', async () => {
      const specificCanteen = mockCanteens[0];
      mockCanteensService.getCanteenById.mockResolvedValue({
        data: specificCanteen,
      });

      const result = await tool.execute(
        { canteenId: 'canteen-1' },
        mockContext,
      );

      expect(mockCanteensService.getCanteenById).toHaveBeenCalledWith(
        'canteen-1',
      );
      expect(result).toEqual([specificCanteen]);
    });

    it('should not call getCanteens when canteenId is provided', async () => {
      mockCanteensService.getCanteenById.mockResolvedValue({
        data: mockCanteens[0],
      });

      await tool.execute({ canteenId: 'canteen-1' }, mockContext);

      expect(mockCanteensService.getCanteens).not.toHaveBeenCalled();
    });

    it('should not call getCanteenById when canteenId is not provided', async () => {
      mockCanteensService.getCanteens.mockResolvedValue({
        data: { items: mockCanteens },
      });

      await tool.execute({}, mockContext);

      expect(mockCanteensService.getCanteenById).not.toHaveBeenCalled();
    });

    it('should return empty array when no canteens found', async () => {
      mockCanteensService.getCanteens.mockResolvedValue({
        data: { items: [] },
      });

      const result = await tool.execute({}, mockContext);

      expect(result).toEqual([]);
    });
  });
});
