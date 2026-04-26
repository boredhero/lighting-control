import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PasskeysSection } from './PasskeysSection'

vi.mock('@/lib/passkey', () => ({
  listPasskeys: vi.fn(),
  enrollPasskey: vi.fn(),
  renamePasskey: vi.fn(),
  deletePasskey: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
  isUserCancellation: (e: unknown) => e instanceof Error && e.name === 'NotAllowedError',
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { listPasskeys, enrollPasskey, renamePasskey, deletePasskey } from '@/lib/passkey'

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PasskeysSection /></QueryClientProvider>)
}

const sample = (overrides: Partial<{ id: string; name: string; non_uv_only: boolean; aaguid: string | null; transports: string[] | null }> = {}) => ({
  id: 'pk-1',
  name: 'Test Key',
  created_at: '2026-01-01T00:00:00Z',
  last_used_at: null,
  transports: ['usb'],
  aaguid: null,
  device_type: 'singleDevice',
  non_uv_only: false,
  ...overrides,
})

describe('PasskeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no passkeys', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([])
    renderSection()
    await waitFor(() => expect(screen.getByTestId('passkeys-empty')).toBeInTheDocument())
  })

  it('lists passkeys with their names', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([sample({ id: 'pk-a', name: 'Alpha' }), sample({ id: 'pk-b', name: 'Bravo' })])
    renderSection()
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
    expect(screen.getByText('Bravo')).toBeInTheDocument()
  })

  it('shows 2FA-only badge for non_uv_only passkeys', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([sample({ id: 'pk-1', name: 'YubiKey', non_uv_only: true })])
    renderSection()
    await waitFor(() => expect(screen.getByText('2FA-only')).toBeInTheDocument())
  })

  it('Add a passkey opens dialog and enroll triggers ceremony', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([])
    vi.mocked(enrollPasskey).mockResolvedValue(sample())
    const user = userEvent.setup()
    renderSection()
    await waitFor(() => expect(screen.getByTestId('passkey-add-button')).toBeInTheDocument())
    await user.click(screen.getByTestId('passkey-add-button'))
    await user.type(screen.getByTestId('passkey-add-name-input'), 'My Key')
    await user.click(screen.getByTestId('passkey-add-confirm'))
    await waitFor(() => expect(enrollPasskey).toHaveBeenCalledWith('My Key'))
  })

  it('rename flow patches the passkey', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([sample({ id: 'pk-1', name: 'Old Name' })])
    vi.mocked(renamePasskey).mockResolvedValue(sample({ id: 'pk-1', name: 'New Name' }))
    const user = userEvent.setup()
    renderSection()
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())
    await user.click(screen.getByTestId('passkey-rename-pk-1'))
    const input = screen.getByTestId('passkey-rename-input')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByTestId('passkey-rename-confirm'))
    await waitFor(() => expect(renamePasskey).toHaveBeenCalledWith('pk-1', 'New Name'))
  })

  it('delete flow asks for confirmation then revokes', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([sample({ id: 'pk-1' }), sample({ id: 'pk-2' })])
    vi.mocked(deletePasskey).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderSection()
    await waitFor(() => expect(screen.getByTestId('passkey-delete-pk-1')).toBeInTheDocument())
    await user.click(screen.getByTestId('passkey-delete-pk-1'))
    await user.click(screen.getByTestId('passkey-delete-confirm'))
    await waitFor(() => expect(deletePasskey).toHaveBeenCalledWith('pk-1'))
  })

  it('delete confirmation shows special copy when this is the last passkey', async () => {
    vi.mocked(listPasskeys).mockResolvedValue([sample({ id: 'only', name: 'Only One' })])
    const user = userEvent.setup()
    renderSection()
    await waitFor(() => expect(screen.getByTestId('passkey-delete-only')).toBeInTheDocument())
    await user.click(screen.getByTestId('passkey-delete-only'))
    expect(screen.getByText(/last passkey/i)).toBeInTheDocument()
  })
})
