import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const mockLogin = vi.fn()
const mockLoginTotp = vi.fn()
const mockFinalizePasskey = vi.fn()
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ login: mockLogin, loginTotp: mockLoginTotp, finalizePasskeyLogin: mockFinalizePasskey, isAuthenticated: false }),
}))

const mockLoginWithPasskey = vi.fn()
vi.mock('@/lib/passkey', () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  browserSupportsWebAuthnAutofill: vi.fn(async () => false),
  loginWithPasskey: (...args: unknown[]) => mockLoginWithPasskey(...args),
  isUserCancellation: () => false,
}))

import { api } from '@/api/client'

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ setup_complete: true })
  })

  it('renders the initial passkey-first stage with passkey button and "use password instead" link', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('login-stage-initial')).toBeInTheDocument())
    expect(screen.getByTestId('passkey-login-button')).toBeInTheDocument()
    expect(screen.getByTestId('use-password-link')).toBeInTheDocument()
  })

  it('clicking "use password instead" reveals the password form', async () => {
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('use-password-link')).toBeInTheDocument())
    await user.click(screen.getByTestId('use-password-link'))
    expect(screen.getByTestId('login-stage-password')).toBeInTheDocument()
  })

  it('password submission with no second factor navigates to /', async () => {
    mockLogin.mockResolvedValue({ available_second_factors: [] })
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('use-password-link')).toBeInTheDocument())
    await user.click(screen.getByTestId('use-password-link'))
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.click(screen.getByTestId('password-submit'))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('alice', 'pw'))
  })

  it('password submission with TOTP factor moves to second_factor stage with TOTP form', async () => {
    mockLogin.mockResolvedValue({ available_second_factors: ['totp'], partial_token: 'PT' })
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('use-password-link')).toBeInTheDocument())
    await user.click(screen.getByTestId('use-password-link'))
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.click(screen.getByTestId('password-submit'))
    await waitFor(() => expect(screen.getByTestId('login-stage-second-factor')).toBeInTheDocument())
    expect(screen.getByTestId('totp-input')).toBeInTheDocument()
  })

  it('password submission with both factors prefers passkey button by default', async () => {
    mockLogin.mockResolvedValue({ available_second_factors: ['totp', 'passkey'], partial_token: 'PT' })
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('use-password-link')).toBeInTheDocument())
    await user.click(screen.getByTestId('use-password-link'))
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.click(screen.getByTestId('password-submit'))
    await waitFor(() => expect(screen.getByTestId('login-stage-second-factor')).toBeInTheDocument())
    expect(screen.getByTestId('second-factor-passkey-button')).toBeInTheDocument()
    expect(screen.queryByTestId('totp-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('swap-second-factor')).toBeInTheDocument()
  })

  it('swap link toggles second-factor selection', async () => {
    mockLogin.mockResolvedValue({ available_second_factors: ['totp', 'passkey'], partial_token: 'PT' })
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('use-password-link')).toBeInTheDocument())
    await user.click(screen.getByTestId('use-password-link'))
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.click(screen.getByTestId('password-submit'))
    await waitFor(() => expect(screen.getByTestId('second-factor-passkey-button')).toBeInTheDocument())
    await user.click(screen.getByTestId('swap-second-factor'))
    expect(screen.getByTestId('totp-input')).toBeInTheDocument()
    expect(screen.queryByTestId('second-factor-passkey-button')).not.toBeInTheDocument()
  })

  it('passkey-first button calls loginWithPasskey with the typed username', async () => {
    mockLoginWithPasskey.mockResolvedValue({ access_token: 'A', refresh_token: 'R' })
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('passkey-login-button')).toBeInTheDocument())
    await user.type(screen.getByTestId('username-input'), 'alice')
    await user.click(screen.getByTestId('passkey-login-button'))
    await waitFor(() => expect(mockLoginWithPasskey).toHaveBeenCalledWith({ username: 'alice' }))
    await waitFor(() => expect(mockFinalizePasskey).toHaveBeenCalledWith('A', 'R'))
  })
})
