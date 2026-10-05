import { apiErrorSchema } from '@ma/protocol'

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function apiOrigin() {
  if (import.meta.env.VITE_API_ORIGIN) return import.meta.env.VITE_API_ORIGIN
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080`
  return 'https://api.ma.cyou'
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Requested-With', 'ma')
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${apiOrigin()}${path}`, { ...init, headers, credentials: 'include' })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new ApiError(res.status, 'bad_response', res.ok ? 'The server sent a response that was not JSON.' : text.slice(0, 180) || res.statusText)
    }
  }
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(data)
    throw new ApiError(res.status, parsed.success ? parsed.data.code : 'http_error', parsed.success ? parsed.data.message : res.statusText, parsed.success ? parsed.data.details : undefined)
  }
  return data as T
}

export async function apiBlob(path: string): Promise<Blob> {
  return apiBlobProgress(path)
}

function readApiError(status: number, text: string, statusText: string): ApiError {
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  const parsed = apiErrorSchema.safeParse(data)
  return new ApiError(status, parsed.success ? parsed.data.code : 'http_error', parsed.success ? parsed.data.message : statusText, parsed.success ? parsed.data.details : undefined)
}

export function apiUpload<T>(path: string, body: FormData, onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal, expectedTotal = 0): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const done = () => signal?.removeEventListener('abort', abort)
    signal?.addEventListener('abort', abort)
    xhr.open('POST', `${apiOrigin()}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'ma')
    xhr.upload.onprogress = (event) => {
      if (signal?.aborted) return
      const total = event.lengthComputable && event.total > 0 ? event.total : expectedTotal
      if (total > 0 || event.loaded > 0) onProgress?.(event.loaded, total || event.loaded)
    }
    xhr.onabort = () => {
      done()
      reject(new DOMException('aborted', 'AbortError'))
    }
    xhr.onload = () => {
      done()
      try {
        if (xhr.status === 204) {
          resolve(undefined as T)
          return
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(readApiError(xhr.status, xhr.responseText, xhr.statusText))
          return
        }
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) as T : undefined as T)
      } catch (err) {
        reject(err)
      }
    }
    xhr.onerror = () => {
      done()
      reject(new ApiError(0, 'network', 'network'))
    }
    xhr.send(body)
  })
}

export function apiBlobProgress(path: string, onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    signal?.addEventListener('abort', abort)
    xhr.open('GET', `${apiOrigin()}${path}`)
    xhr.withCredentials = true
    xhr.responseType = 'blob'
    xhr.setRequestHeader('X-Requested-With', 'ma')
    xhr.onabort = () => {
      signal?.removeEventListener('abort', abort)
      reject(new DOMException('aborted', 'AbortError'))
    }
    xhr.onprogress = (event) => {
      if (signal?.aborted || !event.lengthComputable) return
      onProgress?.(event.loaded, event.total)
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const blob = xhr.response instanceof Blob ? xhr.response : null
        if (!blob) {
          reject(readApiError(xhr.status, '', xhr.statusText))
          return
        }
        void blob.text().then((text) => reject(readApiError(xhr.status, text, xhr.statusText))).catch((err) => reject(err))
        return
      }
      resolve(xhr.response as Blob)
    }
    xhr.onerror = () => reject(new ApiError(0, 'network', 'network'))
    xhr.send()
  })
}

export type BadgeTrack = {
  id: string
  tier: string
  value: number
  next: number | null
}

export type PublicProfile = {
  username: string
  display_name: string
  created_at: string
  invited: number
  badges: string[]
  badge_tracks?: BadgeTrack[]
}

export const authApi = {
  register: (body: { invite_code: string; username: string; password: string; display_name: string }) =>
    api('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { username: string; password: string; device: { name: string; platform: string; pk_ed25519: string; pk_x25519: string } }) =>
    api<{ status: string; challenge_id?: string; user?: { id: string; username: string; display_name: string }; device?: { id: string; trust_state: string } }>('/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  login2fa: (body: { challenge_id: string; code: string }) => api('/v1/auth/login/2fa', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => api('/v1/auth/logout', { method: 'POST' }),
  /** Soft probe: always 200. Use on cold load so logged-out visitors never see a 401. */
  session: () =>
    api<{
      authenticated: boolean
      id?: string
      username?: string
      display_name?: string
      email?: string | null
      totp_enabled?: boolean
      device_id?: string
      trust_state?: string
    }>('/v1/auth/session'),
  me: () => api<{ id: string; username: string; display_name: string; email?: string | null; totp_enabled?: boolean; device_id?: string; trust_state?: string }>('/v1/users/me'),
  patchMe: (body: { display_name?: string; username?: string }) =>
    api<{ username: string; display_name: string }>('/v1/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  account: () =>
    api<{
      id: string
      username: string
      display_name: string
      invite_credits: number
      invited: number
      badges: string[]
      badge_tracks?: BadgeTrack[]
      username_next_at?: string | null
      invitees: { username: string; display_name: string; created_at: string }[]
      open_invites?: { id: string; expires_at: string; created_at: string }[]
    }>('/v1/account'),
  profile: (username: string) => api<PublicProfile>(`/v1/users/${encodeURIComponent(username)}`),
  createInvite: () => api<{ code: string; expires_at: string }>('/v1/invites', { method: 'POST' }),
  revokeInvite: (id: string) => api(`/v1/invites/${id}`, { method: 'DELETE' }),
  loginAccount: (body: { username: string; password: string }) =>
    api<{ status: string; challenge_id?: string; user?: { id: string; username: string; display_name: string } }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...body, device: { name: 'account', platform: 'web', pk_ed25519: '', pk_x25519: '' } }),
    }),
}
