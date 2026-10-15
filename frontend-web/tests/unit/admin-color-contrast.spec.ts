import { describe, expect, it } from 'vitest'
import theme from '../../tailwind.config'

function luminance(hex: string) {
  const channels = hex.replace('#', '').match(/../g)!.map(value => parseInt(value, 16) / 255)
  return channels
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

describe('admin brand interaction colors', () => {
  const { purple, dark } = theme.theme.extend.colors.tsinghua
  it('keeps the primary hover color darker than its resting color', () => {
    expect(luminance(dark)).toBeLessThan(luminance(purple))
  })
  it.each([purple, dark])('keeps normal-size white button text legible on %s', color => {
    expect(1.05 / (luminance(color) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
})
