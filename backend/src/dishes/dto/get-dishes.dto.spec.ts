import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetDishesDto } from './get-dishes.dto';

const requiredSections = ['filter', 'search', 'sort', 'pagination'] as const;
const transformOptions = { enableImplicitConversion: true };
const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};

const createRequest = (): Record<string, unknown> => ({
  filter: {},
  search: { keyword: '' },
  sort: {},
  pagination: { page: 1, pageSize: 10 },
});

const validateRequest = (input: Record<string, unknown>) =>
  validate(
    plainToInstance(GetDishesDto, input, transformOptions),
    validationOptions,
  );

describe('GetDishesDto', () => {
  it('accepts empty filter and sort objects with a complete search and pagination', async () => {
    expect(await validateRequest(createRequest())).toEqual([]);
  });

  it('preserves populated filters, explicit sorting and numeric pagination conversion', async () => {
    const dto = plainToInstance(
      GetDishesDto,
      {
        filter: {
          canteenId: ['canteen-1'],
          windowId: ['window-1'],
          price: { min: 0, max: 20 },
        },
        search: { keyword: '豆腐', fields: ['name', 'tags'] },
        sort: { field: 'price', order: 'asc' },
        pagination: { page: '2', pageSize: '10' },
      },
      transformOptions,
    );

    expect(await validate(dto, validationOptions)).toEqual([]);
    expect(dto.pagination).toMatchObject({ page: 2, pageSize: 10 });
    expect(dto.filter.windowId).toEqual(['window-1']);
  });

  describe.each(requiredSections)('%s', (section) => {
    it('rejects a missing section', async () => {
      const input = createRequest();
      delete input[section];

      const errors = await validateRequest(input);
      expect(errors.some((error) => error.property === section)).toBe(true);
    });

    it.each([
      ['null', null],
      ['an empty array', []],
      ['an array of objects', [{}]],
      ['a string', 'invalid'],
      ['an empty string', ''],
      ['a number', 1],
      ['a boolean', false],
    ])('rejects %s instead of an object', async (_shape, value) => {
      const errors = await validateRequest({
        ...createRequest(),
        [section]: value,
      });

      expect(errors.some((error) => error.property === section)).toBe(true);
    });
  });

  it.each([
    ['filter', { windowId: 'window-1' }],
    ['filter', { unsupportedFilter: true }],
    ['search', {}],
    ['sort', { field: 'unsupported' }],
    ['pagination', { page: 0, pageSize: 10 }],
    ['pagination', {}],
  ])('continues validating nested %s fields', async (section, value) => {
    const errors = await validateRequest({
      ...createRequest(),
      [section as string]: value,
    });

    expect(errors.some((error) => error.property === section)).toBe(true);
  });

  it('returns a bad request from the application validation pipe when sort is absent', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions,
      ...validationOptions,
    });
    const input = createRequest();
    delete input.sort;

    await expect(
      pipe.transform(input, { type: 'body', metatype: GetDishesDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
