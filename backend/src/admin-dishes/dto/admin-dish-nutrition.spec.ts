import 'reflect-metadata';
import { validate } from 'class-validator';
import { AdminCreateDishDto, AdminUpdateDishDto } from './admin-dish.dto';
import { DishDto } from '@/dishes/dto/dish.dto';
import { CONTRIBUTION_FIELDS } from '@/dishes/contribution-fields';

describe('administrator dish nutrition', () => {
  test.each(['calories', 'protein', 'carbohydrate', 'fat'])(
    '%s accepts null and zero and rejects invalid numbers',
    async (field) => {
      for (const Dto of [AdminCreateDishDto, AdminUpdateDishDto]) {
        for (const value of [null, 0, 12.5, undefined]) {
          const errors = await validate(
            Object.assign(new Dto(), {
              name: '菜品',
              price: 1,
              [field]: value,
            }),
          );
          expect(errors.filter((error) => error.property === field)).toEqual(
            [],
          );
        }
        for (const value of [-1, NaN, Infinity, -Infinity, '12', {}, true]) {
          const errors = await validate(
            Object.assign(new Dto(), {
              name: '菜品',
              price: 1,
              [field]: value,
            }),
          );
          expect(errors.some((error) => error.property === field)).toBe(true);
        }
      }
      expect(CONTRIBUTION_FIELDS).toContain(field);
    },
  );
  it('preserves missing data and measured zero in public serialization', () => {
    const dto = DishDto.fromEntity({
      calories: 0,
      protein: 12.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto).toMatchObject({
      calories: 0,
      protein: 12.5,
      carbohydrate: null,
      fat: null,
    });
  });
});
