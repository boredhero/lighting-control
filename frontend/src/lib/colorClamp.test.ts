import { describe, it, expect } from 'vitest'
import { clampMinLuminance, hexToRgb, rgbToHex, MIN_MAX_CHANNEL } from './colorClamp'

describe('MIN_MAX_CHANNEL', () => {
  it('is exported as 24 to match pywizlight 10% brightness floor', () => {
    expect(MIN_MAX_CHANNEL).toBe(24)
  })
})

describe('hexToRgb', () => {
  it('parses 6-digit lowercase hex', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 })
  })
  it('parses 6-digit uppercase hex', () => {
    expect(hexToRgb('#FF8800')).toEqual({ r: 255, g: 136, b: 0 })
  })
  it('parses 3-digit shorthand hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
  it('parses without leading hash', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('throws on malformed hex', () => {
    expect(() => hexToRgb('not-a-hex')).toThrow(/Invalid hex/)
  })
  it('throws on wrong-length hex', () => {
    expect(() => hexToRgb('#ff00')).toThrow(/Invalid hex/)
  })
})

describe('rgbToHex', () => {
  it('emits canonical lowercase 6-digit hex', () => {
    expect(rgbToHex(255, 136, 0)).toBe('#ff8800')
  })
  it('zero-pads single-digit channels', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203')
  })
  it('clamps out-of-range high values', () => {
    expect(rgbToHex(300, 0, 0)).toBe('#ff0000')
  })
  it('clamps out-of-range negative values', () => {
    expect(rgbToHex(-10, 0, 0)).toBe('#000000')
  })
  it('rounds fractional channels', () => {
    expect(rgbToHex(0.4, 0.6, 1.5)).toBe('#000102')
  })
})

describe('clampMinLuminance', () => {
  it('coerces pure black to dark grey at min channel', () => {
    expect(clampMinLuminance('#000000')).toBe('#181818')
  })
  it('boosts peak=23 single-channel red to peak=24', () => {
    expect(clampMinLuminance('#170000')).toBe('#180000')
  })
  it('returns peak=24 single-channel red unchanged', () => {
    expect(clampMinLuminance('#180000')).toBe('#180000')
  })
  it('returns peak=25 single-channel red unchanged', () => {
    expect(clampMinLuminance('#190000')).toBe('#190000')
  })
  it('returns full red unchanged', () => {
    expect(clampMinLuminance('#ff0000')).toBe('#ff0000')
  })
  it('returns full white unchanged', () => {
    expect(clampMinLuminance('#ffffff')).toBe('#ffffff')
  })
  it('boosts a dim primary to min channel without bleeding hue', () => {
    expect(clampMinLuminance('#030000')).toBe('#180000')
  })
  it('boosts equal-low channels into pure dark grey', () => {
    expect(clampMinLuminance('#0a0a0a')).toBe('#181818')
  })
  it('preserves channel ratio on mixed-low input', () => {
    expect(clampMinLuminance('#0c0603')).toBe('#180c06')
  })
  it('canonicalizes uppercase input to lowercase', () => {
    expect(clampMinLuminance('#FF0000')).toBe('#ff0000')
  })
  it('expands shorthand hex to full hex', () => {
    expect(clampMinLuminance('#fff')).toBe('#ffffff')
  })
  it('throws on malformed hex', () => {
    expect(() => clampMinLuminance('not-a-hex')).toThrow(/Invalid hex/)
  })
})
