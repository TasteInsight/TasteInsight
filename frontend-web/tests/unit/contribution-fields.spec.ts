import { describe, expect, it } from 'vitest'
import { formatContributionField, formatContributionPrice } from '../../src/components/Dishes/contribution-fields'

describe('contribution display formatting', () => {
  const priceCases: [number, string | null, string][] = [
    [14, '份', '¥14/份'],
    [14, '元/份', '¥14/份'],
    [2.5, '元/两', '¥2.5/两'],
    [0, '份', '¥0/份'],
    [14, '元', '¥14'],
    [14, null, '¥14'],
  ]
  it.each(priceCases)('formats %s with unit %s', (price, unit, expected) => {
    expect(formatContributionPrice(price, unit)).toBe(expected)
  })

  it('treats the unknown taste sentinel as missing without changing zero prices', () => {
    expect(formatContributionField({ spicyLevel: 0 }, 'spicyLevel')).toBe('未提供')
    expect(formatContributionField({ sweetness: null }, 'sweetness')).toBe('未提供')
    expect(formatContributionField({ saltiness: 3 }, 'saltiness')).toBe('3')
    expect(formatContributionField({ price: 0 }, 'price')).toBe('¥0')
  })
})
