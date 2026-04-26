export const MIN_MAX_CHANNEL = 24

export interface RGB { r: number; g: number; b: number }

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace(/^#/, '').toLowerCase()
  let r: number, g: number, b: number
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16)
    g = parseInt(cleaned[1] + cleaned[1], 16)
    b = parseInt(cleaned[2] + cleaned[2], 16)
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16)
    g = parseInt(cleaned.slice(2, 4), 16)
    b = parseInt(cleaned.slice(4, 6), 16)
  } else {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) throw new Error(`Invalid hex color: ${hex}`)
  return { r, g, b }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

export function clampMinLuminance(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const peak = Math.max(r, g, b)
  if (peak >= MIN_MAX_CHANNEL) return rgbToHex(r, g, b)
  if (peak === 0) return rgbToHex(MIN_MAX_CHANNEL, MIN_MAX_CHANNEL, MIN_MAX_CHANNEL)
  const scale = MIN_MAX_CHANNEL / peak
  return rgbToHex(r * scale, g * scale, b * scale)
}
