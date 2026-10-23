import { RecommendationService } from './recommendation.service';
import { RecommendationScene } from './constants/recommendation.constants';

function fixture() {
  const dish = { id: 'dish', name: '菜品', canteenId: 'canteen' };
  const events = { logImpressions: jest.fn() };
  const experiment = {
    assignUserToExperiment: jest.fn().mockResolvedValue({
      experimentId: 'actual-experiment',
      groupItemId: 'actual-group',
      weights: { preferenceMatch: 0, dishQuality: 50 },
      recallQuota: { vectorQuota: 0, ruleQuota: 1, collaborativeQuota: 0 },
    }),
  };
  const service = new RecommendationService(
    { dish: { findMany: jest.fn().mockResolvedValue([dish]) } } as any,
    null as any,
    events as any,
    experiment as any,
    null as any,
    null as any,
    {
      expandValues: jest
        .fn()
        .mockImplementation(async (values: string[]) => values),
    } as any,
  );
  jest.spyOn(service, 'getUserFeaturesWithCache').mockResolvedValue({
    userId: 'user',
    preferences: null,
    allergens: [],
  } as any);
  jest
    .spyOn(service as any, 'ensureUserEmbeddingAsync')
    .mockImplementation(() => {});
  const seen = jest
    .spyOn(service as any, 'getSeenDishIds')
    .mockResolvedValue(new Set());
  const addSeen = jest
    .spyOn(service as any, 'addSeenDishIds')
    .mockResolvedValue(undefined);
  const vector = jest
    .spyOn(service as any, 'recallByVector')
    .mockResolvedValue([]);
  const rule = jest
    .spyOn(service as any, 'recallByRules')
    .mockResolvedValue(['dish']);
  jest.spyOn(service as any, 'recallByCollaboration').mockResolvedValue([]);
  const score = jest
    .spyOn(service as any, 'scoreCandidates')
    .mockResolvedValue([{ dish, score: 1 }]);
  return { service, events, experiment, seen, addSeen, vector, rule, score };
}

const request = { filter: {}, pagination: { page: 1, pageSize: 1 } };

describe('recommendation request configuration', () => {
  it('uses one automatic assignment for recall, ranking, response and attribution', async () => {
    const f = fixture();
    const result = await f.service.getRecommendations('user', request);
    expect(f.experiment.assignUserToExperiment).toHaveBeenCalledTimes(1);
    expect(f.score.mock.calls[0][2]).toMatchObject({
      preferenceMatch: 0,
      dishQuality: 50,
    });
    expect(f.vector).not.toHaveBeenCalled();
    expect(f.rule.mock.calls[0][0]).toBe(100);
    expect(result.data).toMatchObject({
      experimentId: 'actual-experiment',
      groupItemId: 'actual-group',
    });
    expect(result.data).toHaveProperty(
      'configDigest',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(f.events.logImpressions).toHaveBeenCalledWith(
      'user',
      ['dish'],
      expect.objectContaining({
        experimentId: 'actual-experiment',
        groupItemId: 'actual-group',
        extras: new Map([
          [
            'dish',
            expect.objectContaining({
              configDigest: (result.data as any).configDigest,
            }),
          ],
        ]),
      }),
    );
  });

  it('passes the explicit experiment ID to the single resolver', async () => {
    const f = fixture();
    await f.service.getRecommendations('user', {
      ...request,
      experimentId: 'selected',
    });
    expect(f.experiment.assignUserToExperiment).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ scene: 'home' }),
      'selected',
    );
    expect(f.experiment.assignUserToExperiment).toHaveBeenCalledTimes(1);
  });

  it('preserves search defaults when the group only overrides part of the weights', async () => {
    const f = fixture();
    await f.service.getRecommendations('user', {
      ...request,
      scene: RecommendationScene.SEARCH,
    });
    expect(f.score.mock.calls[0][2]).toMatchObject({
      searchRelevance: 45,
      dishQuality: 50,
      preferenceMatch: 0,
    });
  });

  it('keeps explicitly disabled weights at zero after contextual adjustments', async () => {
    const f = fixture();
    f.experiment.assignUserToExperiment.mockResolvedValue({
      experimentId: 'experiment',
      groupItemId: 'group',
      weights: { favoriteSimilarity: 0, diversity: 0 },
    } as any);
    await f.service.getRecommendations('user', {
      ...request,
      userContext: { exploratory: true, urgency: 'high' },
    });
    expect(f.score.mock.calls[0][2]).toMatchObject({
      favoriteSimilarity: 0,
      diversity: 0,
    });
  });

  it('evaluates the scene baseline without touching online assignment, exposure or seen state', async () => {
    const f = fixture();
    const result = await (f.service.getRecommendations as any)(
      'user',
      {
        ...request,
        requestId: 'online-session',
        experimentId: 'selected',
        scene: RecommendationScene.SEARCH,
      },
      { mode: 'evaluation' },
    );
    expect(f.experiment.assignUserToExperiment).not.toHaveBeenCalled();
    expect(f.events.logImpressions).not.toHaveBeenCalled();
    expect(f.seen).not.toHaveBeenCalled();
    expect(f.addSeen).not.toHaveBeenCalled();
    expect(f.service['ensureUserEmbeddingAsync']).not.toHaveBeenCalled();
    expect(f.score.mock.calls[0][2]).toMatchObject({
      searchRelevance: 45,
      dishQuality: 15,
    });
    expect(result.data.requestId).not.toBe('online-session');
    expect(result.data.groupItemId).toBeUndefined();
  });
});
