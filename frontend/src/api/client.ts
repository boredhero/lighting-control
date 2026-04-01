const API_BASE = '/api'
let isRefreshing = false

async function request<T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const token = localStorage.getItem('access_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers as Record<string, string> }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401 && !_isRetry) {
    const body = await res.clone().json().catch(() => ({ detail: '' }))
    const isTokenIssue = !body.detail || body.detail === 'Invalid token' || body.detail === 'Token revoked' || body.detail === 'User not found'
    if (isTokenIssue && !isRefreshing) {
      isRefreshing = true
      const refreshed = await tryRefresh()
      isRefreshing = false
      if (refreshed) return request<T>(path, options, true)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    }
    throw new Error(body.detail || 'Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return true
  } catch {
    return false
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
