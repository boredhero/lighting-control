import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HierarchyDetailPage } from './HierarchyDetailPage'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/components/LightingStateControl', () => ({
  LightingStateControl: ({ onChange }: { onChange: (s: Record<string, unknown>) => void }) => (
    <div data-testid="mock-lsc">
      <button data-testid="emit-red" onClick={() => onChange({ r: 255, g: 0, b: 0, dimming: 80 })}>emit red</button>
    </div>
  ),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }))

import { api } from '@/api/client'

function renderHierarchy(kind: 'room' | 'zone' | 'group', id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const path = kind === 'room' ? '/rooms/:id' : kind === 'zone' ? '/zones/:id' : '/groups/:id'
  const url = kind === 'room' ? `/rooms/${id}` : kind === 'zone' ? `/zones/${id}` : `/groups/${id}`
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={<HierarchyDetailPage kind={kind} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HierarchyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders room name + member device list', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/rooms') return Promise.resolve([{ id: 'r1', name: 'Kitchen', icon: null }])
      if (path.startsWith('/devices?room_id=')) return Promise.resolve([{ id: 'd1', name: 'Stove', ip: '192.168.1.10', is_online: true, last_state: { dimming: 80, state: true } }])
      return Promise.reject(new Error('unexpected'))
    })
    renderHierarchy('room', 'r1')
    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument())
    expect(screen.getByText('Stove')).toBeInTheDocument()
    expect(screen.getByTestId('hierarchy-detail-page')).toHaveAttribute('data-kind', 'room')
  })

  it('master toggle fires /devices/bulk-control with target_type=room', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/rooms') return Promise.resolve([{ id: 'r1', name: 'Kitchen', icon: null }])
      if (path.startsWith('/devices?room_id=')) return Promise.resolve([{ id: 'd1', name: 'Stove', ip: '192.168.1.10', is_online: true, last_state: { dimming: 80, state: true } }])
      return Promise.reject(new Error('unexpected'))
    })
    vi.mocked(api.post).mockResolvedValue({ success_count: 1, failure_count: 0, failures: [] })
    const user = userEvent.setup()
    renderHierarchy('room', 'r1')
    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument())
    await user.click(screen.getByTestId('hierarchy-master-toggle'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/devices/bulk-control', expect.objectContaining({ target_type: 'room', target_id: 'r1', state: { turn_off: true } })))
  })

  it('renders no-members state for empty group', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/groups') return Promise.resolve([{ id: 'g1', name: 'Empty Group', icon: null }])
      if (path.startsWith('/devices?group_id=')) return Promise.resolve([])
      return Promise.reject(new Error('unexpected'))
    })
    renderHierarchy('group', 'g1')
    await waitFor(() => expect(screen.getByText('Empty Group')).toBeInTheDocument())
    expect(screen.getByTestId('hierarchy-no-members')).toBeInTheDocument()
  })

  it('per-device toggle fires /devices/{id}/control, not bulk', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/zones') return Promise.resolve([{ id: 'z1', name: 'Upstairs', icon: null }])
      if (path.startsWith('/devices?zone_id=')) return Promise.resolve([{ id: 'd9', name: 'Bed Light', ip: '192.168.1.99', is_online: true, last_state: { state: true, dimming: 50 } }])
      return Promise.reject(new Error('unexpected'))
    })
    vi.mocked(api.post).mockResolvedValue({ success: true })
    const user = userEvent.setup()
    renderHierarchy('zone', 'z1')
    await waitFor(() => expect(screen.getByText('Bed Light')).toBeInTheDocument())
    await user.click(screen.getByTestId('device-toggle-d9'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/devices/d9/control', expect.objectContaining({ state: { turn_off: true } })))
    const bulkCalls = vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/devices/bulk-control')
    expect(bulkCalls).toHaveLength(0)
  })
})
