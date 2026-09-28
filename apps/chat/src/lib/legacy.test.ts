import { describe, expect, it } from 'vitest'
import { legacyKeyMatches } from './legacy'

describe('legacy vault claim', () => {
  it('refuses a vault whose identity key does not match the account', () => {
    expect(legacyKeyMatches({ signPk: 'a', signSk: 'b', boxPk: 'ccccccccccccccccccccccccccccccccccccccccccc', boxSk: 'd' }, 'other')).toBe(false)
  })

  it('allows a match and an account that has not published a key yet', () => {
    const keys = { signPk: 'a', signSk: 'b', boxPk: 'AQID', boxSk: 'd' }
    expect(legacyKeyMatches(keys, '')).toBe(true)
    expect(legacyKeyMatches(null, '')).toBe(false)
  })
})
