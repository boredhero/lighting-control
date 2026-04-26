import { create } from 'zustand'
import { api } from '@/api/client'

interface User {
  id: string
  username: string
  is_admin: boolean
  is_guest: boolean
  totp_enabled: boolean
  permissions: Record<string, boolean>
}

export interface LoginResult {
  available_second_factors: string[]
  partial_token?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<LoginResult>
  loginTotp: (code: string, partialToken: string) => Promise<void>
  finalizePasskeyLogin: (accessToken: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  login: async (username: string, password: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string; available_second_factors: string[]; partial_token: string | null }>('/auth/login', { username, password })
    const factors = data.available_second_factors || []
    if (factors.length > 0) {
      return { available_second_factors: factors, partial_token: data.partial_token ?? undefined }
    }
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ isAuthenticated: true })
    await get().fetchUser()
    return { available_second_factors: [] }
  },
  loginTotp: async (code: string, partialToken: string) => {
    const data = await api.post<{ access_token: string; refresh_token: string }>('/auth/login/totp', { code, partial_token: partialToken })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ isAuthenticated: true })
    await get().fetchUser()
  },
  finalizePasskeyLogin: async (accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ isAuthenticated: true })
    await get().fetchUser()
  },
  logout: async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
  fetchUser: async () => {
    try {
      const user = await api.get<User>('/auth/me')
      set({ user, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
    }
  },
  hasPermission: (permission: string) => {
    const { user } = get()
    if (!user) return false
    if (user.is_admin) return true
    return user.permissions[permission] === true
  },
}))
