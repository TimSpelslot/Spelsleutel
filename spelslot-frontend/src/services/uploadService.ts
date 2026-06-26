import { firebaseAuth } from '@/firebase'
import type { Result } from '@/types'
import { t } from '@/i18n'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Result<string>> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { type: 'error', message: t('errors.invalidFileType') }
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { type: 'error', message: t('errors.fileTooLarge', { max: MAX_SIZE_MB }) }
  }

  const token = await firebaseAuth.currentUser?.getIdToken()
  if (!token) return { type: 'error', message: t('errors.notAuthenticated') }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { url } = JSON.parse(xhr.responseText) as { url: string }
          resolve({ type: 'ok', data: `${BASE_URL}${url}` })
        } catch {
          resolve({ type: 'error', message: t('errors.unexpectedServerResponse') })
        }
      } else {
        try {
          const { message } = JSON.parse(xhr.responseText) as { message?: string }
          resolve({
            type: 'error',
            message: message ?? t('errors.uploadFailedHttp', { status: xhr.status }),
          })
        } catch {
          resolve({ type: 'error', message: t('errors.uploadFailedHttp', { status: xhr.status }) })
        }
      }
    })

    xhr.addEventListener('error', () =>
      resolve({ type: 'error', message: t('errors.networkErrorDuringUpload') }),
    )
    xhr.addEventListener('abort', () =>
      resolve({ type: 'error', message: t('errors.uploadCancelled') }),
    )

    xhr.open('POST', `${BASE_URL}/api/upload/image`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(form)
  })
}
