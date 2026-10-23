import { RecallQualityService } from './recall-quality.service';

it('runs historical interaction diagnostics in isolated evaluation mode', async () => {
  const recommendation = {
    getRecommendations: jest
      .fn()
      .mockResolvedValue({ data: { items: [{ id: 'dish' }] } }),
  };
  const metrics = {
    generateRecallQualityReport: jest
      .fn()
      .mockResolvedValue({ summary: 'diagnostic' }),
  };
  const service = new RecallQualityService(
    {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user' }]) },
    } as any,
    metrics as any,
    recommendation as any,
  );
  const result = await service.evaluateRecallQuality({
    k: 10,
    days: 7,
    sampleSize: 10,
  });
  expect(result.data.summary).toContain('历史交互命中诊断');
  expect(recommendation.getRecommendations).toHaveBeenCalledWith(
    'user',
    {
      scene: 'home',
      pagination: { page: 1, pageSize: 10 },
      filter: {},
    },
    { mode: 'evaluation' },
  );
  expect(metrics.generateRecallQualityReport).toHaveBeenCalledWith(
    new Map([['user', ['dish']]]),
    { k: 10, days: 7 },
  );
});
