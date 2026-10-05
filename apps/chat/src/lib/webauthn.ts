import { b64, unb64 } from '@ma/crypto'

const RP_NAME = 'ma.cyou Chat'

function rpId() {
  return window.location.hostname
}

function randomChallenge() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

type PrfExtensionResults = {
  prf?: {
    enabled?: boolean
    results?: { first?: ArrayBuffer }
  }
}

function prfFirst(cred: PublicKeyCredential | null): Uint8Array | null {
  if (!cred || typeof cred.getClientExtensionResults !== 'function') return null
  const ext = cred.getClientExtensionResults() as PrfExtensionResults
  const first = ext.prf?.results?.first
  if (!first) return null
  return new Uint8Array(first)
}

export async function platformAuthenticatorAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  if (!navigator.credentials?.create || !navigator.credentials?.get) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Create a platform passkey with PRF and return credential id + PRF bytes for the given salt. */
export async function createPrfCredential(opts: {
  userId: string
  userName: string
  displayName: string
  prfSalt: Uint8Array
}): Promise<{ credentialId: string; prf: Uint8Array }> {
  const userIdBytes = new TextEncoder().encode(opts.userId).slice(0, 64)
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { id: rpId(), name: RP_NAME },
      user: {
        id: userIdBytes,
        name: opts.userName || 'chat',
        displayName: opts.displayName || opts.userName || 'Chat vault',
      },
      challenge: randomChallenge(),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
        requireResidentKey: false,
      },
      timeout: 120_000,
      attestation: 'none',
      extensions: {
        prf: {
          eval: { first: opts.prfSalt },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('webauthn_cancelled')
  const ext = cred.getClientExtensionResults() as PrfExtensionResults
  if (ext.prf && ext.prf.enabled === false) throw new Error('webauthn_prf_unsupported')
  let prf = prfFirst(cred)
  // Some authenticators only return PRF on get(); fall through to assert.
  if (!prf) {
    prf = await evaluatePrf(cred.rawId, opts.prfSalt)
  }
  if (!prf) throw new Error('webauthn_prf_unsupported')
  return { credentialId: b64(new Uint8Array(cred.rawId)), prf }
}

export async function evaluatePrf(
  credentialId: ArrayBuffer | Uint8Array | string,
  prfSalt: Uint8Array,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const id = typeof credentialId === 'string' ? unb64(credentialId) : credentialId instanceof Uint8Array ? credentialId : new Uint8Array(credentialId)
  const assertion = (await navigator.credentials.get({
    publicKey: {
      rpId: rpId(),
      challenge: randomChallenge(),
      allowCredentials: [{ type: 'public-key', id }],
      userVerification: 'required',
      timeout: 120_000,
      extensions: {
        prf: {
          eval: { first: prfSalt },
        },
      } as AuthenticationExtensionsClientInputs,
    },
    signal,
  })) as PublicKeyCredential | null
  return prfFirst(assertion)
}
