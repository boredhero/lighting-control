import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemperatureSlider, BrightnessSlider } from '@/components/LightingSlider'
import { clampMinLuminance, hexToRgb, rgbToHex } from '@/lib/colorClamp'
import { BUILTIN_SCENES_BY_ID } from '@/lib/builtinScenes'
import { Palette, Thermometer, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StateValue = Record<string, unknown>

interface LightingStateControlProps {
  value: StateValue
  onChange: (state: StateValue) => void
  size?: 'compact' | 'full'
  className?: string
}

type TabKey = 'color' | 'temp' | 'scene'
type Mode = 'off' | TabKey

const DEFAULT_COLOR = '#F59E0B'
const DEFAULT_BRIGHTNESS = 100
const DEFAULT_TEMP = 4000

function inferMode(v: StateValue): Mode {
  if (v.turn_off === true || v.state === false) return 'off'
  if (v.scene !== undefined || v.sceneId !== undefined) return 'scene'
  if (v.temp !== undefined) return 'temp'
  return 'color'
}

function inferColor(v: StateValue, fallback: string): string {
  if (typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number') return rgbToHex(v.r, v.g, v.b)
  return fallback
}

function inferDimming(v: StateValue, fallback: number): number {
  return typeof v.dimming === 'number' ? v.dimming : fallback
}

function inferTemp(v: StateValue, fallback: number): number {
  return typeof v.temp === 'number' ? v.temp : fallback
}

function inferScene(v: StateValue): number | null {
  if (typeof v.scene === 'number') return v.scene
  if (typeof v.sceneId === 'number') return v.sceneId
  return null
}

export function LightingStateControl({ value, onChange, size = 'full', className }: LightingStateControlProps) {
  const [prevValue, setPrevValue] = useState<StateValue | null>(null)
  const [tab, setTab] = useState<TabKey>('color')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS)
  const [temp, setTemp] = useState(DEFAULT_TEMP)
  const [turnedOff, setTurnedOff] = useState(false)
  if (value !== prevValue) {
    setPrevValue(value)
    const mode = inferMode(value)
    setTurnedOff(mode === 'off')
    if (mode !== 'off') setTab(mode)
    setColor(inferColor(value, color))
    setBrightness(inferDimming(value, brightness))
    setTemp(inferTemp(value, temp))
  }
  const sceneId = inferScene(value)
  const handleTurnOff = (off: boolean) => {
    setTurnedOff(off)
    onChange(off ? { turn_off: true } : { dimming: brightness })
  }
  const handleColorChange = (raw: string) => {
    const clamped = clampMinLuminance(raw)
    setColor(clamped)
    const { r, g, b } = hexToRgb(clamped)
    onChange({ r, g, b, dimming: brightness })
  }
  const handleBrightness = (v: number) => {
    setBrightness(v)
    if (tab === 'color') {
      const { r, g, b } = hexToRgb(color)
      onChange({ r, g, b, dimming: v })
    } else if (tab === 'temp') {
      onChange({ temp, dimming: v })
    }
  }
  const handleTempChange = (v: number) => {
    setTemp(v)
    onChange({ temp: v, dimming: brightness })
  }
  const handleTabChange = (next: string) => {
    const t = next as TabKey
    setTab(t)
    if (t === 'color') {
      const { r, g, b } = hexToRgb(color)
      onChange({ r, g, b, dimming: brightness })
    } else if (t === 'temp') {
      onChange({ temp, dimming: brightness })
    }
  }
  const compact = size === 'compact'
  return (
    <div className={cn('flex flex-col gap-4', compact && 'p-3 bg-[var(--surface-2)] rounded-lg', className)} data-size={size} data-testid="lighting-state-control">
      <div className="flex items-center gap-3">
        <Switch checked={turnedOff} onCheckedChange={handleTurnOff} data-testid="lsc-turn-off" />
        <Label className="text-sm">{turnedOff ? 'Turn Off' : 'Turn On / Set State'}</Label>
      </div>
      {!turnedOff && (
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="color"><Palette className="size-[14px] mr-1" />Color</TabsTrigger>
            <TabsTrigger value="temp"><Thermometer className="size-[14px] mr-1" />Temperature</TabsTrigger>
            <TabsTrigger value="scene"><Sparkles className="size-[14px] mr-1" />Scene</TabsTrigger>
          </TabsList>
          <TabsContent value="color" className={cn('flex flex-col items-center', compact ? 'gap-3 mt-3' : 'gap-4 3xl:gap-6 mt-4')}>
            <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%', maxWidth: compact ? 240 : 'min(28rem, 100%)' }} />
            <p className="text-xs 3xl:text-sm tv:text-base text-muted-foreground font-mono" data-testid="lsc-current-color">{color}</p>
            <BrightnessSlider value={brightness} onChange={handleBrightness} />
            <div className="flex justify-between text-[10px] 3xl:text-xs tv:text-sm text-muted-foreground px-1 font-medium w-full">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </TabsContent>
          <TabsContent value="temp" className={cn('flex flex-col', compact ? 'gap-3 mt-3' : 'gap-4 3xl:gap-6 mt-4 pt-9 3xl:pt-11')}>
            <TemperatureSlider value={temp} onChange={handleTempChange} min={2200} max={6500} step={100} />
            <div className="flex justify-between text-[10px] 3xl:text-xs tv:text-sm text-muted-foreground px-1 font-medium">
              <span>2200K</span><span>2700K</span><span>4000K</span><span>5000K</span><span>6500K</span>
            </div>
            <div className={cn(compact ? 'pt-4' : 'pt-6 3xl:pt-8')}>
              <BrightnessSlider value={brightness} onChange={handleBrightness} />
              <div className="flex justify-between text-[10px] 3xl:text-xs tv:text-sm text-muted-foreground px-1 font-medium mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="scene" className="flex flex-col items-center gap-3 mt-4">
            {sceneId !== null && (
              <p className="text-sm text-foreground" data-testid="lsc-scene-name">
                Current scene: <span className="font-medium">{BUILTIN_SCENES_BY_ID[sceneId] ?? `Unknown scene (#${sceneId})`}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center max-w-md">Scene editing is coming soon. For now, use Color or Temperature.</p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
