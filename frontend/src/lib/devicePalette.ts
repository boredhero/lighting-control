export interface DeviceLike {
  is_online: boolean
  last_state: Record<string, unknown> | null
}

export type PaletteVariant = 'card' | 'chip'

export interface DevicePalette {
  bg: string
  border: string
  iconBg: string
  iconFg: string
  pillBg: string
  pillText: string
}

function srgbToLinear(c: number): number {
  const cn = c / 255
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4)
}

function rgbToOklch(r: number, g: number, b: number): { hue: number; chroma: number } {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const lLong = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const mLong = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const sLong = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const lp = Math.cbrt(lLong)
  const mp = Math.cbrt(mLong)
  const sp = Math.cbrt(sLong)
  const aLab = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp
  const bLab = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp
  const chroma = Math.sqrt(aLab * aLab + bLab * bLab)
  const hueDeg = (Math.atan2(bLab, aLab) * 180) / Math.PI
  return { hue: hueDeg < 0 ? hueDeg + 360 : hueDeg, chroma }
}

function tempToHue(temp: number): number {
  if (temp <= 2700) return 30
  if (temp <= 4000) return 50
  if (temp <= 5000) return 210
  return 235
}

interface HueResult { hue: number; chromaScale: number }

const GOLD_FALLBACK: HueResult = { hue: 75, chromaScale: 0.7 }

function getDeviceHue(device: DeviceLike): HueResult | null {
  if (!device.is_online) return null
  const s = device.last_state
  if (!s || s.state === false) return null
  const r = typeof s.r === 'number' ? (s.r as number) : null
  const g = typeof s.g === 'number' ? (s.g as number) : null
  const b = typeof s.b === 'number' ? (s.b as number) : null
  if (r !== null && g !== null && b !== null) {
    if (r === 0 && g === 0 && b === 0) {
      if (typeof s.temp === 'number') return { hue: tempToHue(s.temp as number), chromaScale: 0.4 }
      return GOLD_FALLBACK
    }
    const oklch = rgbToOklch(r, g, b)
    if (oklch.chroma < 0.02) return { hue: GOLD_FALLBACK.hue, chromaScale: 0.4 }
    return { hue: oklch.hue, chromaScale: 1.0 }
  }
  if (typeof s.temp === 'number') return { hue: tempToHue(s.temp as number), chromaScale: 0.4 }
  return GOLD_FALLBACK
}

const PRESETS: Record<PaletteVariant, { bg: { l: number; c: number }; border: { l: number; c: number }; iconBg: { l: number; c: number }; iconFg: { l: number; c: number }; pillBg: { l: number; c: number } }> = {
  card: {
    bg: { l: 0.20, c: 0.04 },
    border: { l: 0.35, c: 0.08 },
    iconBg: { l: 0.30, c: 0.10 },
    iconFg: { l: 0.78, c: 0.16 },
    pillBg: { l: 0.55, c: 0.18 },
  },
  chip: {
    bg: { l: 0.22, c: 0.025 },
    border: { l: 0.30, c: 0.05 },
    iconBg: { l: 0.30, c: 0.05 },
    iconFg: { l: 0.78, c: 0.16 },
    pillBg: { l: 0.55, c: 0.18 },
  },
}

function fmt(l: number, c: number, h: number): string {
  return `oklch(${l} ${c} ${h})`
}

export function getDevicePalette(device: DeviceLike, variant: PaletteVariant = 'card'): DevicePalette | null {
  const hueResult = getDeviceHue(device)
  if (!hueResult) return null
  const { hue, chromaScale } = hueResult
  const p = PRESETS[variant]
  return {
    bg: fmt(p.bg.l, p.bg.c * chromaScale, hue),
    border: fmt(p.border.l, p.border.c * chromaScale, hue),
    iconBg: fmt(p.iconBg.l, p.iconBg.c * chromaScale, hue),
    iconFg: fmt(p.iconFg.l, p.iconFg.c * chromaScale, hue),
    pillBg: fmt(p.pillBg.l, p.pillBg.c * chromaScale, hue),
    pillText: 'oklch(0.985 0 0)',
  }
}

export function getDeviceBrightness(device: DeviceLike): number | null {
  if (!device.is_online || !device.last_state || device.last_state.state === false) return null
  if (typeof device.last_state.dimming === 'number') return device.last_state.dimming as number
  return null
}

export function getStatePalette(state: Record<string, unknown> | null | undefined, variant: PaletteVariant = 'card'): DevicePalette | null {
  if (!state) return null
  if (state.turn_off === true || state.state === false) return null
  return getDevicePalette({ is_online: true, last_state: state }, variant)
}
