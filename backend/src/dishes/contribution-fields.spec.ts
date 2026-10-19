import { BadRequestException } from '@nestjs/common';
import {
  prepareContribution,
  sameValue,
  changedDishData,
  requestFingerprint,
  assertBaseline,
  contributionSnapshot,
} from './contribution-fields';

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

describe('Contribution managed image identity', () => {
  const asset =
    'https://api.example.test/content-moderation/images/asset_identity_123456';
  const first = `${asset}?expires=1000&signature=first`,
    refreshed = `${asset}?expires=2000&signature=second`;
  const another =
    'https://api.example.test/content-moderation/images/another_asset_123456';
  it('deduplicates managed identities when preparing and publishing images while preserving order', async () => {
    const tx = {
      canteen: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c', name: '食堂' }),
      },
    } as any;
    const input = {
      name: '菜品',
      price: 2,
      availableMealTime: [],
      canteenId: 'c',
      images: [another, first, refreshed],
    };
    expect((await prepareContribution(tx, input)).images).toEqual([
      another,
      asset,
    ]);
    expect(
      changedDishData({ images: [refreshed, another] }, { images: [first] }, [
        'images',
      ]).images,
    ).toEqual([asset, another]);
  });
  it('compares image fields and snapshots by identity and retains image order changes', () => {
    expect(sameValue([first, another], [refreshed, another], 'images')).toBe(
      true,
    );
    expect(sameValue([first, another], [another, refreshed], 'images')).toBe(
      false,
    );
    expect(() =>
      assertBaseline({ images: [refreshed] }, { images: [first] }, ['images']),
    ).not.toThrow();
    expect(contributionSnapshot({ images: [first, refreshed] }).images).toEqual(
      [asset],
    );
  });
  it('keeps request identity stable across refreshed previews while retaining ordinary URL parameters', () => {
    expect(requestFingerprint({ images: [first], clientRequestId: 'a' })).toBe(
      requestFingerprint({ images: [refreshed], clientRequestId: 'a' }),
    );
    expect(requestFingerprint({ images: [first, another] })).not.toBe(
      requestFingerprint({ images: [another, refreshed] }),
    );
    expect(
      sameValue(
        ['https://cdn.example.test/image?version=1'],
        ['https://cdn.example.test/image?version=2'],
        'images',
      ),
    ).toBe(false);
  });
});
