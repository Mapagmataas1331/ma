import { apiErrorSchema } from '@ma/protocol'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
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
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(data)
    throw new ApiError(res.status, parsed.success ? parsed.data.code : 'http_error', parsed.success ? parsed.data.message : res.statusText)
  }
  return data as T
}

export type PublicProfile = {
  username: string
  display_name: string
  created_at: string
  invited: number
  badges: string[]
}

export const authApi = {
  register: (body: { invite_code: string; username: string; password: string; display_name: string }) =>
    api('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { username: string; password: string; device: { name: string; platform: string; pk_ed25519: string; pk_x25519: string } }) =>
    api<{ status: string; challenge_id?: string; user?: { id: string; username: string; display_name: string }; device?: { id: string; trust_state: string } }>('/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  login2fa: (body: { challenge_id: string; code: string }) => api('/v1/auth/login/2fa', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => api('/v1/auth/logout', { method: 'POST' }),
  me: () => api<{ id: string; username: string; display_name: string; email?: string | null; totp_enabled?: boolean }>('/v1/users/me'),
  account: () =>
    api<{
      id: string
      username: string
      display_name: string
      invite_credits: number
      invited: number
      badges: string[]
      invitees: { username: string; display_name: string; created_at: string }[]
    }>('/v1/account'),
  profile: (username: string) => api<PublicProfile>(`/v1/users/${encodeURIComponent(username)}`),
  createInvite: () => api<{ code: string; expires_at: string }>('/v1/invites', { method: 'POST' }),
  loginAccount: (body: { username: string; password: string }) =>
    api<{ status: string; challenge_id?: string; user?: { id: string; username: string; display_name: string } }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...body, device: { name: 'account', platform: 'web', pk_ed25519: '', pk_x25519: '' } }),
    }),
}
