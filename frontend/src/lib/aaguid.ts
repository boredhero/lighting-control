export type PasskeyIcon = 'platform' | 'key' | 'cloud' | 'extension'
export interface AaguidEntry { name: string; icon: PasskeyIcon }

const TABLE: Record<string, AaguidEntry> = {
  '00000000-0000-0000-0000-000000000000': { name: 'Passkey', icon: 'cloud' },
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': { name: 'Google Password Manager', icon: 'cloud' },
  'adce0002-35bc-c60a-648b-0b25f1f05503': { name: 'Chrome on Mac', icon: 'platform' },
  '08987058-cadc-4b81-b6e1-30de50dcbe96': { name: 'Windows Hello', icon: 'platform' },
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': { name: 'Windows Hello', icon: 'platform' },
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': { name: 'Windows Hello', icon: 'platform' },
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': { name: 'iCloud Keychain (Managed)', icon: 'cloud' },
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': { name: 'iCloud Keychain', icon: 'cloud' },
  'ee882879-721c-4913-9775-3dfcce97072a': { name: '1Password', icon: 'extension' },
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': { name: 'NordPass', icon: 'extension' },
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': { name: 'YubiKey 5', icon: 'key' },
  'fa2b99dc-9e39-4257-8f92-4a30d23c4118': { name: 'YubiKey 5 NFC', icon: 'key' },
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': { name: 'YubiKey 5 NFC', icon: 'key' },
  'c5ef55ff-ad9a-4b9f-b580-adebafe026d0': { name: 'YubiKey 5Ci', icon: 'key' },
  'd8522d9f-575b-4866-88a9-ba99fa02f35b': { name: 'YubiKey BIO', icon: 'key' },
  '149a2021-8ef6-4133-96b8-81f8d5b7f1f5': { name: 'Security Key by Yubico', icon: 'key' },
  'b92c3f9a-c014-4056-887f-140a2501163b': { name: 'Security Key by Yubico', icon: 'key' },
  '3b1adb99-0dfe-46fd-90b8-7f7614a4de2a': { name: 'Bitwarden', icon: 'extension' },
}

export function lookupAaguid(aaguid: string | null | undefined, transports?: string[] | null): AaguidEntry {
  if (aaguid && TABLE[aaguid.toLowerCase()]) return TABLE[aaguid.toLowerCase()]
  const t = transports || []
  if (t.includes('internal')) return { name: 'Platform passkey', icon: 'platform' }
  if (t.includes('usb') || t.includes('nfc')) return { name: 'Security key', icon: 'key' }
  if (t.includes('hybrid')) return { name: 'Phone passkey', icon: 'cloud' }
  return { name: 'Passkey', icon: 'cloud' }
}
