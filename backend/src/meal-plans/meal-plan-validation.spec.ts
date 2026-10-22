import { assertDietaryExclusions } from './meal-plan-validation';

it.each(['  PiNe  NuTs  ', 'Pine\t\nNuts', '\u3000Pine\u00A0Nuts\uFEFF'])(
  'rejects a complete allergen term with equivalent whitespace: %s',
  (value) => {
    expect(() =>
      assertDietaryExclusions([{ allergens: [value], ingredients: [] }], {
        allergens: ['pine nuts'],
        avoidIngredients: [],
      }),
    ).toThrow('忌口');
  },
);
it('keeps full phrase boundaries for curated and private terms', () => {
  expect(() =>
    assertDietaryExclusions(
      [
        {
          allergens: ['Pine nutshell', 'private phrase extra'],
          ingredients: [],
        },
      ],
      {
        allergens: ['pine nuts', 'private phrase'],
        avoidIngredients: [],
      },
    ),
  ).not.toThrow();
});
