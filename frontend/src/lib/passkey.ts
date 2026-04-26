import { startRegistration, startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnError } from '@simplewebauthn/browser'
import { api } from '@/api/client'

export interface PasskeySummary {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  transports: string[] | null
  aaguid: string | null
  device_type: string | null
  non_uv_only: boolean
}

export interface BeginRegisterResponse { options: Record<string, unknown>; session_id: string }
export interface BeginAuthResponse { options: Record<string, unknown>; session_id: string }
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  available_second_factors: string[]
  requires_totp?: boolean
  requires_passkey?: boolean
  partial_token: string | null
}

export { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnError }

export async function enrollPasskey(name: string): Promise<PasskeySummary> {
  const begin = await api.post<BeginRegisterResponse>('/auth/me/passkeys/register/start', undefined, { withCookies: true })
  // @ts-expect-error - simplewebauthn accepts the JSON-serialized options
  const credential = await startRegistration({ optionsJSON: begin.options })
  return api.post<PasskeySummary>('/auth/me/passkeys/register/finish', { credential, name, session_id: begin.session_id }, { withCookies: true })
}

export async function loginWithPasskey(opts: { username?: string; partialToken?: string; useBrowserAutofill?: boolean; signal?: AbortSignal }): Promise<TokenResponse> {
  const begin = await api.post<BeginAuthResponse>('/auth/login/passkey/start', { username: opts.username, partial_token: opts.partialToken }, { withCookies: true })
  // @ts-expect-error - simplewebauthn accepts the JSON-serialized options
  const credential = await startAuthentication({ optionsJSON: begin.options, useBrowserAutofill: !!opts.useBrowserAutofill })
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return api.post<TokenResponse>('/auth/login/passkey/finish', { credential, session_id: begin.session_id, partial_token: opts.partialToken }, { withCookies: true })
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  return api.get<PasskeySummary[]>('/auth/me/passkeys')
}

export async function renamePasskey(id: string, name: string): Promise<PasskeySummary> {
  return api.patch<PasskeySummary>(`/auth/me/passkeys/${id}`, { name })
}

export async function deletePasskey(id: string): Promise<void> {
  await api.delete(`/auth/me/passkeys/${id}`)
}

export function isUserCancellation(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'NotAllowedError' || err.name === 'AbortError'
}
