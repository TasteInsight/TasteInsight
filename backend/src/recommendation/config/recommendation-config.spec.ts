import {
  parseRecommendationConfig,
  resolveRecommendationConfig,
} from './recommendation-config';
import { RecommendationScene } from '../constants/recommendation.constants';

describe('recommendation configuration contract', () => {
  it.each([
    { weights: { preferenceMatch: -1 } },
    { weights: { preferenceMatch: NaN } },
    { weights: { preferenceMatch: Infinity } },
    { weights: { preferenceMatch: '25' } },
    { weights: { typo: 1 } },
    { algorithm: 'unused' },
    { recallQuota: { vectorQuota: 1 } },
    { recallQuota: { vectorQuota: -1, ruleQuota: 1, collaborativeQuota: 1 } },
    {
      recallQuota: {
        vectorQuota: 0.5,
        ruleQuota: 0.5,
        collaborativeQuota: 0.5,
      },
    },
    {
      weights: {
        preferenceMatch: 0,
        favoriteSimilarity: 0,
        browseRelevance: 0,
        dishQuality: 0,
        diversity: 0,
        searchRelevance: 0,
      },
    },
    { weights: { preferenceMatch: 1e308, dishQuality: 1e308 } },
  ])('rejects invalid or unsupported configuration %j', (value) => {
    expect(() => parseRecommendationConfig(value)).toThrow();
  });

  it('keeps explicit zeros and inherits missing weights from the scene', () => {
    const result = resolveRecommendationConfig(
      { weights: { preferenceMatch: 0 } },
      RecommendationScene.SEARCH,
    );
    expect(result.weights).toMatchObject({
      preferenceMatch: 0,
      searchRelevance: 45,
    });
    expect(result.recallQuota).toEqual({
      vectorQuota: 0.6,
      ruleQuota: 0.3,
      collaborativeQuota: 0.1,
    });
  });

  it('supports disabling recall routes explicitly', () => {
    expect(
      parseRecommendationConfig({
        recallQuota: { vectorQuota: 0, ruleQuota: 1, collaborativeQuota: 0 },
      }).recallQuota?.vectorQuota,
    ).toBe(0);
  });

  it('hashes resolved values independently of object key order and explicit defaults', () => {
    const baseline = resolveRecommendationConfig({}, RecommendationScene.HOME);
    const explicit = resolveRecommendationConfig(
      { weights: { dishQuality: 18, preferenceMatch: 25 } },
      RecommendationScene.HOME,
    );
    expect(explicit.configDigest).toBe(baseline.configDigest);
    expect(
      resolveRecommendationConfig({}, RecommendationScene.SEARCH).configDigest,
    ).not.toBe(baseline.configDigest);
  });

  it('accepts an absent legacy configuration as the baseline', () => {
    expect(parseRecommendationConfig(null)).toEqual({});
    expect(parseRecommendationConfig(undefined)).toEqual({});
  });
});
