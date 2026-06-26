import { firebaseAuth } from '@/firebase'
import type { Result } from '@/types'
import { t } from '@/i18n'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = firebaseAuth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function handleResponse<T>(res: Response): Promise<Result<T>> {
  if (res.ok) {
    const data = (await res.json()) as T
    return { type: 'ok', data }
  }

  if (res.status === 401) {
    try {
      const body = (await res.json()) as { message?: string }
      const msg = body.message
      return {
        type: 'error',
        message: msg && msg !== 'Unauthorized' ? msg : t('errors.notLoggedIn'),
      }
    } catch {
      return { type: 'error', message: t('errors.notLoggedIn') }
    }
  }

  if (res.status === 403) {
    return { type: 'error', message: t('errors.noPermission') }
  }

  try {
    const body = (await res.json()) as { message?: string }
    if (body.message) return { type: 'error', message: body.message }
  } catch {
    /* body not JSON */
  }

  return { type: 'error', message: t('errors.httpStatus', { status: res.status }) }
}

export const api = {
  async get<T>(path: string): Promise<Result<T>> {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${BASE_URL}${path}`, { headers: authHeader })
      return handleResponse<T>(res)
    } catch {
      return {
        type: 'error',
        message: t('errors.networkError'),
      }
    }
  },

  async post<T>(path: string, body: unknown): Promise<Result<T>> {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(body),
      })
      return handleResponse<T>(res)
    } catch {
      return {
        type: 'error',
        message: t('errors.networkError'),
      }
    }
  },

  async patch<T>(path: string, body: unknown): Promise<Result<T>> {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(body),
      })
      return handleResponse<T>(res)
    } catch {
      return {
        type: 'error',
        message: t('errors.networkError'),
      }
    }
  },

  async put<T>(path: string, body: unknown): Promise<Result<T>> {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(body),
      })
      return handleResponse<T>(res)
    } catch {
      return {
        type: 'error',
        message: t('errors.networkError'),
      }
    }
  },

  async delete<T>(path: string, body?: unknown): Promise<Result<T>> {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'DELETE',
        headers: body ? { 'Content-Type': 'application/json', ...authHeader } : authHeader,
        body: body ? JSON.stringify(body) : undefined,
      })
      return handleResponse<T>(res)
    } catch {
      return {
        type: 'error',
        message: t('errors.networkError'),
      }
    }
  },
}
