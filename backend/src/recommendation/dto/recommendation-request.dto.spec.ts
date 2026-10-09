import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecommendationRequestDto } from './recommendation-request.dto';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};

const validateExclusions = (excludeDishIds: unknown) => {
  const dto = plainToInstance(RecommendationRequestDto, {
    filter: { excludeDishIds },
    pagination: { page: 1, pageSize: 5 },
  });
  return validate(dto, validationOptions);
};

describe('RecommendationFilterDto exclusions', () => {
  it.each([
    ['an omitted field', undefined],
    ['an empty list', []],
    ['one ID', ['previous-option']],
    ['100 IDs', Array.from({ length: 100 }, (_, index) => `dish-${index}`)],
  ])('accepts %s', async (_shape, ids) => {
    expect(await validateExclusions(ids)).toEqual([]);
  });

  it.each([
    ['a scalar', 'previous-option'],
    ['a non-string ID', [1]],
    ['an empty ID', ['']],
    ['duplicate IDs', ['previous-option', 'previous-option']],
    [
      'more than 100 IDs',
      Array.from({ length: 101 }, (_, index) => `dish-${index}`),
    ],
  ])('rejects %s', async (_shape, ids) => {
    const errors = await validateExclusions(ids);
    const filterErrors = errors.find((error) => error.property === 'filter');
    expect(
      filterErrors?.children?.some(
        (error) => error.property === 'excludeDishIds',
      ),
    ).toBe(true);
  });
});
