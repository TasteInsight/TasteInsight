import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadDishDto } from './upload-dish.dto';

test('accepts zero-price submission without a window, but rejects invalid window value types', async () => {
  const base = {
    name: '清炒时蔬',
    price: 0,
    canteenName: '第一食堂',
    availableMealTime: ['lunch'],
  };
  expect(await validate(plainToInstance(UploadDishDto, base))).toHaveLength(0);
  const errors = await validate(
    plainToInstance(UploadDishDto, { ...base, windowName: 42 }),
  );
  expect(errors.some((error) => error.property === 'windowName')).toBe(true);
});

test('validates nullable finite nonnegative contribution nutrition and allows selecting nutrition fields', async () => {
  const base = {
    targetDishId: 'dish',
    changedFields: ['calories', 'protein', 'carbohydrate', 'fat'],
  };
  for (const value of [undefined, null, 0, 12.5]) {
    const dto = plainToInstance(UploadDishDto, {
      ...base,
      calories: value,
      protein: value,
      carbohydrate: value,
      fat: value,
    });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.calories).toBe(value);
  }
  for (const value of [-1, NaN, Infinity, -Infinity, '12']) {
    const errors = await validate(
      plainToInstance(UploadDishDto, { ...base, calories: value }),
    );
    expect(errors.some((error) => error.property === 'calories')).toBe(true);
  }
});
