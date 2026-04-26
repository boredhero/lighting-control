import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LightingStateControl, type StateValue } from './LightingStateControl'

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
    <div data-testid="mock-picker" data-color={color}>
      <button data-testid="pick-black" onClick={() => onChange('#000000')}>pick black</button>
      <button data-testid="pick-red" onClick={() => onChange('#ff0000')}>pick red</button>
      <button data-testid="pick-near-black" onClick={() => onChange('#0a0a0a')}>pick near black</button>
    </div>
  ),
}))

vi.mock('@/components/LightingSlider', () => ({
  TemperatureSlider: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <input data-testid="mock-temp-slider" type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} min={2200} max={6500} step={100} />
  ),
  BrightnessSlider: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <input data-testid="mock-brightness-slider" type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} min={0} max={100} step={1} />
  ),
}))

describe('LightingStateControl', () => {
  let onChange: Mock<(state: StateValue) => void>
  beforeEach(() => { onChange = vi.fn() })

  describe('initial tab inference', () => {
    it('defaults to color tab for empty value', () => {
      render(<LightingStateControl value={{}} onChange={onChange} />)
      expect(screen.getByRole('tab', { name: /color/i })).toHaveAttribute('aria-selected', 'true')
    })
    it('selects color tab for rgb value', () => {
      render(<LightingStateControl value={{ r: 255, g: 0, b: 0 }} onChange={onChange} />)
      expect(screen.getByRole('tab', { name: /color/i })).toHaveAttribute('aria-selected', 'true')
    })
    it('selects temperature tab for temp value', () => {
      render(<LightingStateControl value={{ temp: 3000 }} onChange={onChange} />)
      expect(screen.getByRole('tab', { name: /temperature/i })).toHaveAttribute('aria-selected', 'true')
    })
    it('selects scene tab for scene value', () => {
      render(<LightingStateControl value={{ scene: 5 }} onChange={onChange} />)
      expect(screen.getByRole('tab', { name: /scene/i })).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('turn off', () => {
    it('hides tabs when turn_off is true', () => {
      render(<LightingStateControl value={{ turn_off: true }} onChange={onChange} />)
      expect(screen.queryByRole('tab', { name: /color/i })).not.toBeInTheDocument()
      expect(screen.getByText(/turn off/i)).toBeInTheDocument()
    })
    it('hides tabs when legacy state:false set', () => {
      render(<LightingStateControl value={{ state: false }} onChange={onChange} />)
      expect(screen.queryByRole('tab', { name: /color/i })).not.toBeInTheDocument()
    })
    it('flipping switch on emits turn_off:true only', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{ dimming: 80 }} onChange={onChange} />)
      await user.click(screen.getByTestId('lsc-turn-off'))
      expect(onChange).toHaveBeenLastCalledWith({ turn_off: true })
    })
    it('flipping switch off emits dimming state', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{ turn_off: true }} onChange={onChange} />)
      await user.click(screen.getByTestId('lsc-turn-off'))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dimming: expect.any(Number) }))
      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ turn_off: true }))
    })
  })

  describe('color picking', () => {
    it('picking pure black emits clamped grey rgb', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{}} onChange={onChange} />)
      await user.click(screen.getByTestId('pick-black'))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ r: 24, g: 24, b: 24 }))
    })
    it('picking near-black hex clamps before emit', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{}} onChange={onChange} />)
      await user.click(screen.getByTestId('pick-near-black'))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ r: 24, g: 24, b: 24 }))
    })
    it('picking full red emits unclamped rgb', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{}} onChange={onChange} />)
      await user.click(screen.getByTestId('pick-red'))
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ r: 255, g: 0, b: 0 }))
    })
  })

  describe('sliders', () => {
    it('brightness change on color tab emits rgb + dimming', () => {
      render(<LightingStateControl value={{ r: 100, g: 50, b: 25, dimming: 80 }} onChange={onChange} />)
      fireEvent.change(screen.getByTestId('mock-brightness-slider'), { target: { value: '60' } })
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dimming: 60, r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) }))
    })
    it('temperature change emits temp + dimming', () => {
      render(<LightingStateControl value={{ temp: 3000, dimming: 80 }} onChange={onChange} />)
      fireEvent.change(screen.getByTestId('mock-temp-slider'), { target: { value: '5500' } })
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ temp: 5500, dimming: 80 }))
    })
  })

  describe('tab switching', () => {
    it('switching to temperature emits temp + dimming', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{ r: 255, g: 0, b: 0, dimming: 80 }} onChange={onChange} />)
      await user.click(screen.getByRole('tab', { name: /temperature/i }))
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ temp: expect.any(Number), dimming: 80 }))
    })
    it('switching to color emits rgb + dimming', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{ temp: 3000, dimming: 80 }} onChange={onChange} />)
      await user.click(screen.getByRole('tab', { name: /color/i }))
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number), dimming: 80 }))
    })
    it('switching to scene tab does not emit onChange', async () => {
      const user = userEvent.setup()
      render(<LightingStateControl value={{ r: 255, g: 0, b: 0, dimming: 80 }} onChange={onChange} />)
      onChange.mockClear()
      await user.click(screen.getByRole('tab', { name: /scene/i }))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('scene tab placeholder', () => {
    it('renders coming-soon text when no scene set', () => {
      render(<LightingStateControl value={{ scene: 1 }} onChange={onChange} />)
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    })
    it('renders scene name for known builtin id', () => {
      render(<LightingStateControl value={{ scene: 1 }} onChange={onChange} />)
      expect(screen.getByTestId('lsc-scene-name')).toHaveTextContent(/Ocean/)
    })
    it('renders unknown-scene fallback for out-of-range id', () => {
      render(<LightingStateControl value={{ scene: 999 }} onChange={onChange} />)
      expect(screen.getByTestId('lsc-scene-name')).toHaveTextContent(/Unknown scene/)
    })
  })

  describe('size variants', () => {
    it('full size sets data-size=full', () => {
      render(<LightingStateControl value={{}} onChange={onChange} size="full" />)
      expect(screen.getByTestId('lighting-state-control')).toHaveAttribute('data-size', 'full')
    })
    it('compact size sets data-size=compact', () => {
      render(<LightingStateControl value={{}} onChange={onChange} size="compact" />)
      expect(screen.getByTestId('lighting-state-control')).toHaveAttribute('data-size', 'compact')
    })
  })

  describe('no spurious emissions', () => {
    it('does not call onChange on initial mount', () => {
      render(<LightingStateControl value={{ r: 255, g: 0, b: 0, dimming: 80 }} onChange={onChange} />)
      expect(onChange).not.toHaveBeenCalled()
    })
    it('does not call onChange when value prop changes externally', () => {
      const { rerender } = render(<LightingStateControl value={{ r: 255, g: 0, b: 0 }} onChange={onChange} />)
      onChange.mockClear()
      rerender(<LightingStateControl value={{ r: 0, g: 255, b: 0 }} onChange={onChange} />)
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})
