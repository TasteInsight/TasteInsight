import { RecommendationService } from './recommendation.service';

it('excludes unknown contributed tastes separately for each preference dimension', () => {
  const service = Object.create(RecommendationService.prototype);
  const result = service.extractFavoriteFeatures(
    [{ dishId: 'a' }, { dishId: 'b' }],
    new Map([
      [
        'a',
        {
          id: 'a',
          spicyLevel: 5,
          sweetness: 0,
          saltiness: 2,
          oiliness: 0,
          price: 0,
        },
      ],
      [
        'b',
        {
          id: 'b',
          spicyLevel: 0,
          sweetness: 3,
          saltiness: 4,
          oiliness: 0,
          price: 10,
        },
      ],
    ]),
  );
  expect(result).toMatchObject({
    avgSpicyLevel: 5,
    avgSweetness: 3,
    avgSaltiness: 3,
    avgOiliness: 0,
    avgPrice: 5,
  });
});
