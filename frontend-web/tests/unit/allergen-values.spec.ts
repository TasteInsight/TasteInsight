import { describe, expect, it } from 'vitest'
import { normalizeAllergenText, parseAllergenList } from '@/utils/allergen-values'

describe('allergen input values', () => {
  it('collapses Unicode whitespace without removing English word boundaries', () => {
    expect(normalizeAllergenText('\uFEFF Pine\t\nNuts\u3000')).toBe('Pine Nuts')
    expect(parseAllergenList(' Pine\tNuts, PINE  NUTS；Milk\u00A0protein\n私人  成分')).toEqual([
      'Pine Nuts',
      'Milk protein',
      '私人 成分',
    ])
  })
  it('keeps complete phrases separate from substrings', () => {
    expect(parseAllergenList('Pine Nuts, Pine nutshell')).toEqual(['Pine Nuts', 'Pine nutshell'])
  })
})

it('uses the same fixed Unicode folding for exact complete terms', () => {
  expect(parseAllergenList('ΟΣ,οσ,ος;Straße;STRASSE;Ᲊ;ᲊ;Ɤ;ɤ;İ;i;i\u0307')).toEqual([
    'ΟΣ',
    'Straße',
    'Ᲊ',
    'Ɤ',
    'İ',
    'i',
  ])
  expect(parseAllergenList('PINE  NUTS, pine\t nuts; NUTS')).toEqual(['PINE NUTS', 'NUTS'])
})
