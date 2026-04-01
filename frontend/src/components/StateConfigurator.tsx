import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface StateConfiguratorProps {
  state: Record<string, unknown>
  onChange: (state: Record<string, unknown>) => void
}

export function StateConfigurator({ state, onChange }: StateConfiguratorProps) {
  const [color, setColor] = useState('#F59E0B')
  const [brightness, setBrightness] = useState((state.dimming as number) || 100)
  const [colorTemp, setColorTemp] = useState((state.temp as number) || 4000)
  const [turnOff, setTurnOff] = useState(state.state === false)
  const hexToRgb = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) })
  const handleColorChange = (hex: string) => { setColor(hex); const { r, g, b } = hexToRgb(hex); onChange({ r, g, b, dimming: brightness }) }
  const handleBrightness = (value: number | readonly number[]) => { const v = Array.isArray(value) ? value[0] : value; setBrightness(v); onChange({ ...state, dimming: v }) }
  const handleTemp = (value: number | readonly number[]) => { const v = Array.isArray(value) ? value[0] : value; setColorTemp(v); onChange({ temp: v, dimming: brightness }) }
  const handleTurnOff = (off: boolean) => { setTurnOff(off); onChange(off ? { state: false } : { dimming: brightness }) }
  return (
    <div className="flex flex-col gap-4 p-3 bg-[var(--surface-2)] rounded-lg">
      <div className="flex items-center gap-3">
        <Switch checked={turnOff} onCheckedChange={handleTurnOff} />
        <Label className="text-sm">{turnOff ? 'Turn Off' : 'Turn On / Set State'}</Label>
      </div>
      {!turnOff && (
        <Tabs defaultValue="color">
          <TabsList><TabsTrigger value="color">Color</TabsTrigger><TabsTrigger value="temp">Temperature</TabsTrigger><TabsTrigger value="scene">Scene</TabsTrigger></TabsList>
          <TabsContent value="color" className="flex flex-col items-center gap-3 mt-3">
            <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%', maxWidth: 240 }} />
            <div className="flex items-center gap-3 w-full"><Label className="text-xs w-16">Brightness</Label><Slider value={[brightness]} onValueChange={handleBrightness} max={100} step={1} className="flex-1" /><span className="text-xs w-8 text-right">{brightness}%</span></div>
          </TabsContent>
          <TabsContent value="temp" className="flex flex-col gap-3 mt-3">
            <div className="flex items-center gap-3"><Label className="text-xs w-16">Temp</Label><Slider value={[colorTemp]} onValueChange={handleTemp} min={2200} max={6500} step={100} className="flex-1" /><span className="text-xs w-12 text-right">{colorTemp}K</span></div>
            <div className="flex items-center gap-3"><Label className="text-xs w-16">Brightness</Label><Slider value={[brightness]} onValueChange={handleBrightness} max={100} step={1} className="flex-1" /><span className="text-xs w-8 text-right">{brightness}%</span></div>
          </TabsContent>
          <TabsContent value="scene" className="mt-3">
            <p className="text-xs text-muted-foreground">Scene selector coming soon — use Color or Temperature for now.</p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
