import { firebaseAuth } from '@/firebase'
import type { Result } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Result<string>> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { type: 'error', message: 'Only JPEG, PNG, WebP and GIF images are allowed.' }
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { type: 'error', message: `Image must be smaller than ${MAX_SIZE_MB} MB.` }
  }

  const token = await firebaseAuth.currentUser?.getIdToken()
  if (!token) return { type: 'error', message: 'Not authenticated.' }

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
          resolve({ type: 'error', message: 'Unexpected server response.' })
        }
      } else {
        try {
          const { message } = JSON.parse(xhr.responseText) as { message?: string }
          resolve({ type: 'error', message: message ?? `Upload failed (HTTP ${xhr.status})` })
        } catch {
          resolve({ type: 'error', message: `Upload failed (HTTP ${xhr.status})` })
        }
      }
    })

    xhr.addEventListener('error', () => resolve({ type: 'error', message: 'Network error during upload.' }))
    xhr.addEventListener('abort', () => resolve({ type: 'error', message: 'Upload cancelled.' }))

    xhr.open('POST', `${BASE_URL}/api/upload/image`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(form)
  })
}
