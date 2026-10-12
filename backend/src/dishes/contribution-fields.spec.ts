import { BadRequestException } from '@nestjs/common';
import { prepareContribution } from './contribution-fields';

describe('Contribution parent authority', () => {
  const input = {
    name: '子菜品',
    price: 9,
    availableMealTime: ['lunch'],
    canteenId: 'canteen',
    parentDishId: 'historical-parent',
  };
  const parentStates = [
    ['removed', null],
    [
      'moved',
      { id: 'historical-parent', canteenId: 'another', status: 'online' },
    ],
    [
      'reparented',
      {
        id: 'historical-parent',
        canteenId: 'canteen',
        status: 'offline',
        parentDishId: 'formal-dish',
      },
    ],
  ] as const;

  function database(parent: unknown) {
    return {
      canteen: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'canteen', name: '食堂' }),
      },
      dish: { findUnique: jest.fn().mockResolvedValue(parent) },
    };
  }

  it.each(parentStates)(
    'does not use a %s historical parent when editing an existing formal identity',
    async (_state, parent) => {
      const tx = database(parent);
      const data = await prepareContribution(tx as any, input, null, {
        approvedDishId: 'formal-dish',
        parentDishId: 'historical-parent',
      });
      expect(data).toMatchObject({ price: 9, canteenId: 'canteen' });
      expect(data).not.toHaveProperty('parentDishId');
      expect(tx.dish.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each(parentStates)(
    'still rejects a %s parent for a first publication',
    async (_state, parent) => {
      const tx = database(parent);
      await expect(prepareContribution(tx as any, input)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.dish.findUnique).toHaveBeenCalledWith({
        where: { id: 'historical-parent' },
      });
    },
  );
});
