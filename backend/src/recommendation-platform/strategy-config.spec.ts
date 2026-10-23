import { BadRequestException } from '@nestjs/common';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import { builtInBaseline, parseStrategy } from './strategy-config';

describe('published strategy ranking contract', () => {
  const scene = RecommendationScene.HOME;

  it('accepts rules and a model strategy with its explicit runtime budget', () => {
    const baseline = builtInBaseline(scene);
    expect(parseStrategy(baseline, scene)).toEqual(baseline);
    const model = {
      ...baseline,
      ranking: {
        type: 'model_endpoint',
        modelVersionId: 'ranker-v2',
        timeoutMs: 800,
      },
    };
    expect(parseStrategy(model, scene)).toEqual(model);
  });

  it('rejects rule weights on a model strategy instead of saving ineffective tuning', () => {
    const baseline = builtInBaseline(scene);
    expect(() =>
      parseStrategy(
        {
          ...baseline,
          ranking: {
            ...baseline.ranking,
            type: 'model_endpoint',
            modelVersionId: 'ranker-v2',
            timeoutMs: 800,
          },
        },
        scene,
      ),
    ).toThrow(BadRequestException);
  });

  it.each([{ timeoutMs: 800 }, { modelVersionId: 'ranker-v2' }])(
    'rejects unused model parameters on rule ranking: %j',
    (parameters) => {
      const baseline = builtInBaseline(scene);
      expect(() =>
        parseStrategy(
          { ...baseline, ranking: { ...baseline.ranking, ...parameters } },
          scene,
        ),
      ).toThrow(BadRequestException);
    },
  );
});
