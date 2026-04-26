import { describe, it, expect } from 'vitest'
import { lookupAaguid } from './aaguid'

describe('lookupAaguid', () => {
  it('returns table entry for known AAGUID', () => {
    expect(lookupAaguid('cb69481e-8ff7-4039-93ec-0a2729a154a8').name).toBe('YubiKey 5')
  })
  it('is case-insensitive on the AAGUID', () => {
    expect(lookupAaguid('CB69481E-8FF7-4039-93EC-0A2729A154A8').name).toBe('YubiKey 5')
  })
  it('falls back to Platform passkey for unknown AAGUID with internal transport', () => {
    const r = lookupAaguid('not-a-real-aaguid', ['internal'])
    expect(r.name).toBe('Platform passkey')
    expect(r.icon).toBe('platform')
  })
  it('falls back to Security key for unknown AAGUID with usb transport', () => {
    const r = lookupAaguid('not-a-real-aaguid', ['usb', 'nfc'])
    expect(r.name).toBe('Security key')
    expect(r.icon).toBe('key')
  })
  it('falls back to generic Passkey for null AAGUID and no transports', () => {
    expect(lookupAaguid(null, null).name).toBe('Passkey')
  })
  it('handles all-zero AAGUID (anonymous passkey) gracefully', () => {
    expect(lookupAaguid('00000000-0000-0000-0000-000000000000').name).toBe('Passkey')
  })
  it('handles undefined transports', () => {
    expect(lookupAaguid('not-a-real-aaguid').icon).toBe('cloud')
  })
})
