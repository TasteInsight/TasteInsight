import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadDishDto } from './upload-dish.dto';

test('accepts zero-price submission without a window, but rejects invalid window value types', async () => {
  const base = {name:'清炒时蔬',price:0,canteenName:'第一食堂',availableMealTime:['lunch']};
  expect(await validate(plainToInstance(UploadDishDto,base))).toHaveLength(0);
  const errors = await validate(plainToInstance(UploadDishDto,{...base,windowName:42}));
  expect(errors.some(error=>error.property==='windowName')).toBe(true);
});
