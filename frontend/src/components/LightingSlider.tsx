import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

const TEMP_GRADIENT = 'linear-gradient(to right, #ff7a1f 0%, #ffae5b 12%, #ffd09a 30%, #ffe7c8 54%, #fdf3e6 77%, #e8efff 100%)'

interface SliderBaseProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

function ValueTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute -top-9 3xl:-top-11 tv:-top-14 left-1/2 -translate-x-1/2 px-2 py-1 3xl:px-3 3xl:py-1.5 tv:px-4 tv:py-2 rounded-md bg-popover text-popover-foreground text-xs 3xl:text-sm tv:text-lg font-semibold whitespace-nowrap pointer-events-none ring-1 ring-foreground/10 shadow-md">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 size-0 border-4 border-transparent border-t-popover" />
    </div>
  )
}

interface TemperatureSliderProps extends SliderBaseProps { showTicks?: boolean }

export function TemperatureSlider({ value, onChange, min = 2200, max = 6500, step = 100, showTicks = true, className }: TemperatureSliderProps) {
  const tickPositions = [2700, 4000, 5000].filter((k) => k > min && k < max)
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
      min={min}
      max={max}
      step={step}
      className={cn('w-full', className)}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none cursor-pointer">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow rounded-2xl h-14 3xl:h-16 tv:h-24 ring-1 ring-white/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.15),inset_0_-2px_4px_rgba(0,0,0,0.25)] overflow-hidden"
          style={{ background: TEMP_GRADIENT }}
        >
          <SliderPrimitive.Indicator className="hidden" />
          {showTicks && tickPositions.map((k) => (
            <div
              key={k}
              className="absolute top-3 bottom-3 w-px bg-black/20"
              style={{ left: `${((k - min) / (max - min)) * 100}%` }}
              aria-hidden
            />
          ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="relative block w-1.5 h-14 3xl:h-16 tv:h-24 shrink-0 rounded-full bg-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/60 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[0_0_0_1.5px_rgba(0,0,0,0.5),0_6px_20px_rgba(0,0,0,0.55)]">
          <ValueTooltip>{value}K</ValueTooltip>
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export function BrightnessSlider({ value, onChange, min = 0, max = 100, step = 1, className }: SliderBaseProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
      min={min}
      max={max}
      step={step}
      className={cn('w-full', className)}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none cursor-pointer">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow rounded-2xl h-14 3xl:h-16 tv:h-24 bg-[var(--surface-3)] ring-1 ring-white/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),inset_0_-2px_4px_rgba(0,0,0,0.25)] overflow-hidden"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-900 via-amber-600 to-[var(--color-amber)]"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="relative block w-1.5 h-14 3xl:h-16 tv:h-24 shrink-0 rounded-full bg-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/60 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[0_0_0_1.5px_rgba(0,0,0,0.5),0_6px_20px_rgba(0,0,0,0.55)]">
          <ValueTooltip>{value}%</ValueTooltip>
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
