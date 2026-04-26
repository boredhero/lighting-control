import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasskeyEnrollmentPrompt, isPasskeyPromptDismissed } from './PasskeyEnrollmentPrompt'

vi.mock('@/lib/passkey', () => ({
  enrollPasskey: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
  isUserCancellation: (e: unknown) => e instanceof Error && e.name === 'NotAllowedError',
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { enrollPasskey } from '@/lib/passkey'

describe('PasskeyEnrollmentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows the dialog when open=true', () => {
    render(<PasskeyEnrollmentPrompt open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('Set up a passkey?')).toBeInTheDocument()
  })

  it('Set up now triggers enrollPasskey with the entered name', async () => {
    vi.mocked(enrollPasskey).mockResolvedValue({ id: '1', name: 'My Phone', created_at: '', last_used_at: null, transports: null, aaguid: null, device_type: null, non_uv_only: false })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PasskeyEnrollmentPrompt open={true} onOpenChange={onChange} />)
    const input = screen.getByTestId('passkey-name-input')
    await user.clear(input)
    await user.type(input, 'My Phone')
    await user.click(screen.getByTestId('passkey-setup'))
    await waitFor(() => expect(enrollPasskey).toHaveBeenCalledWith('My Phone'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })

  it("Don't ask again sets localStorage and closes", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PasskeyEnrollmentPrompt open={true} onOpenChange={onChange} />)
    await user.click(screen.getByTestId('passkey-dontask'))
    expect(isPasskeyPromptDismissed()).toBe(true)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('Skip for now closes without dismissing forever', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PasskeyEnrollmentPrompt open={true} onOpenChange={onChange} />)
    await user.click(screen.getByTestId('passkey-skip'))
    expect(isPasskeyPromptDismissed()).toBe(false)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
