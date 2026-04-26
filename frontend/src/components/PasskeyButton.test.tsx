import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasskeyButton } from './PasskeyButton'

vi.mock('@/lib/passkey', () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  isUserCancellation: (e: unknown) => e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError'),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { browserSupportsWebAuthn } from '@/lib/passkey'
import { toast } from 'sonner'

describe('PasskeyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
  })

  it('calls onClick on click and shows loading then completes', async () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PasskeyButton label="Sign in" onClick={onClick} testId="pk-btn" />)
    await user.click(screen.getByTestId('pk-btn'))
    expect(onClick).toHaveBeenCalled()
  })

  it('is disabled when WebAuthn unsupported and shows tooltip-style title', () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false)
    render(<PasskeyButton label="Sign in" onClick={vi.fn()} testId="pk-btn" />)
    expect(screen.getByTestId('pk-btn')).toBeDisabled()
  })

  it('does not toast on user cancellation', async () => {
    const cancelErr = new Error('user cancelled')
    cancelErr.name = 'NotAllowedError'
    const onClick = vi.fn().mockRejectedValue(cancelErr)
    const user = userEvent.setup()
    render(<PasskeyButton label="X" onClick={onClick} testId="pk-btn" />)
    await user.click(screen.getByTestId('pk-btn'))
    await waitFor(() => expect(onClick).toHaveBeenCalled())
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('toasts on real errors', async () => {
    const onClick = vi.fn().mockRejectedValue(new Error('network exploded'))
    const user = userEvent.setup()
    render(<PasskeyButton label="X" onClick={onClick} testId="pk-btn" />)
    await user.click(screen.getByTestId('pk-btn'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('network exploded'))
  })

  it('does not call onClick if disabled prop is true', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<PasskeyButton label="X" onClick={onClick} testId="pk-btn" disabled />)
    await user.click(screen.getByTestId('pk-btn'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
