export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,10}[a-z0-9])?$/

export function graphemeLength(value: string) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length
  }
  return [...value].length
}

export function canonicalUsername(value: string) {
  return value.trim().toLowerCase()
}

export function usernameError(value: string) {
  const name = canonicalUsername(value)
  if (!USERNAME_PATTERN.test(name)) return 'username must be 3-12 letters, numbers, or underscores'
  return ''
}

export function canonicalDisplayName(value: string) {
  return value.trim().normalize('NFC')
}

function rejectedText(value: string) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 31 || code === 127 || code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return true
  }
  return false
}

export function displayNameError(value: string) {
  if (rejectedText(value)) return 'display name must be 1-32 characters'
  const name = canonicalDisplayName(value)
  const length = graphemeLength(name)
  if (length < 1 || length > 32) return 'display name must be 1-32 characters'
  return ''
}

function passwordLengthError(value: string, min: number) {
  const length = [...value].length
  if (length < min) return `password must be at least ${min} characters`
  if (length > 128 || new TextEncoder().encode(value).length > 512) return 'password must be at most 128 characters'
  return ''
}

/** Account password. Checked by the server. */
export function passwordError(value: string) {
  return passwordLengthError(value, 8)
}

/** Vault password. Stays on this device and is never sent to the server. */
export function vaultPasswordError(value: string) {
  return passwordLengthError(value, 4)
}

export function deviceNameError(value: string) {
  return groupNameError(value).replace('group name', 'device name')
}

export function groupNameError(value: string) {
  const length = graphemeLength(value.trim())
  if (length < 1 || length > 64) return 'group name must be 1-64 characters'
  return ''
}
