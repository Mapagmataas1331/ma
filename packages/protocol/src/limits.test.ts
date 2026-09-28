import { describe, expect, it } from 'vitest'
import { canonicalDisplayName, displayNameError, groupNameError, passwordError, usernameError } from './limits'

describe('account field limits', () => {
  it('accepts a short username and rejects underscores at the ends', () => {
    expect(usernameError('ab')).not.toBe('')
    expect(usernameError('abc')).toBe('')
    expect(usernameError('_ab')).not.toBe('')
    expect(usernameError('a_b')).toBe('')
    expect(usernameError('abcdefghijklm')).not.toBe('')
  })

  it('normalizes display names and rejects controls', () => {
    expect(canonicalDisplayName('  Å  ')).toBe('Å')
    expect(displayNameError('A')).toBe('')
    expect(displayNameError('a\n')).not.toBe('')
    expect(displayNameError('')).not.toBe('')
  })

  it('checks password length without trimming', () => {
    expect(passwordError('short')).not.toBe('')
    expect(passwordError('correct horse')).toBe('')
    expect(passwordError(` ${'x'.repeat(10)}`)).toBe('')
    expect(passwordError('x'.repeat(129))).not.toBe('')
  })

  it('bounds group names', () => {
    expect(groupNameError('')).not.toBe('')
    expect(groupNameError('friends')).toBe('')
    expect(groupNameError('g'.repeat(65))).not.toBe('')
  })
})
