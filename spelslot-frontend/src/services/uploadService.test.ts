import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/firebase', () => ({
  firebaseAuth: { currentUser: null as null | { getIdToken: () => Promise<string> } },
}))

import { uploadImage } from './uploadService'
import { firebaseAuth } from '@/firebase'

// ── fake XHR infrastructure ───────────────────────────────────────────────────

interface FakeXhr {
  status: number
  responseText: string
  open: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  upload: { addEventListener: ReturnType<typeof vi.fn> }
  addEventListener: (event: string, cb: () => void) => void
  _listeners: Record<string, () => void>
  trigger: (event: string) => void
}

function makeFakeXhr(): FakeXhr {
  const _listeners: Record<string, () => void> = {}
  return {
    status: 200,
    responseText: '',
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    upload: { addEventListener: vi.fn() },
    addEventListener(event: string, cb: () => void) {
      _listeners[event] = cb
    },
    _listeners,
    trigger(event: string) {
      _listeners[event]?.()
    },
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFile(options: { type?: string; sizeBytes?: number; name?: string } = {}): File {
  const { type = 'image/png', sizeBytes = 1024, name = 'test.png' } = options
  const blob = new Blob([new Uint8Array(sizeBytes)], { type })
  return new File([blob], name, { type })
}

function withAuth(token = 'test-token') {
  ;(firebaseAuth as { currentUser: { getIdToken: () => Promise<string> } | null }).currentUser = {
    getIdToken: vi.fn().mockResolvedValue(token),
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

let fakeXhr: FakeXhr

beforeEach(() => {
  ;(firebaseAuth as { currentUser: null | { getIdToken: () => Promise<string> } }).currentUser =
    null
  fakeXhr = makeFakeXhr()
  vi.stubGlobal('XMLHttpRequest', function () {
    return fakeXhr
  })
})

describe('uploadImage — pre-flight validation', () => {
  it('should return error for a disallowed MIME type without touching XHR', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const file = makeFile({ type: 'application/pdf' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await uploadImage(file)

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    expect(fakeXhr.open).not.toHaveBeenCalled()
  })

  it('should return error for a file exceeding 5 MB without touching XHR', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const file = makeFile({ sizeBytes: 6 * 1024 * 1024 })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await uploadImage(file)

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    expect(fakeXhr.open).not.toHaveBeenCalled()
  })

  it('should return error when no auth token is available', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    // firebaseAuth.currentUser remains null from beforeEach
    const file = makeFile()

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await uploadImage(file)

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Not authenticated.')
    }
    expect(fakeXhr.open).not.toHaveBeenCalled()
  })
})

describe('uploadImage — XHR success path', () => {
  it('should return ok with the URL on a 200 response', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()
    fakeXhr.status = 200
    fakeXhr.responseText = JSON.stringify({ url: '/uploads/image.png' })

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    // Trigger the load event after the XHR is set up
    await Promise.resolve()
    fakeXhr.trigger('load')
    const result = await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toContain('/uploads/image.png')
    }
  })

  it('should set the Authorization header with the Bearer token', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth('my-secret-token')
    const file = makeFile()
    fakeXhr.status = 200
    fakeXhr.responseText = JSON.stringify({ url: '/uploads/x.png' })

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    await Promise.resolve()
    fakeXhr.trigger('load')
    await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(fakeXhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer my-secret-token')
  })
})

describe('uploadImage — XHR error paths', () => {
  it('should return error on HTTP 400+ response', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()
    fakeXhr.status = 422
    fakeXhr.responseText = JSON.stringify({ message: 'Invalid image format' })

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    await Promise.resolve()
    fakeXhr.trigger('load')
    const result = await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Invalid image format')
    }
  })

  it('should return error with fallback message on HTTP error without body message', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()
    fakeXhr.status = 500
    fakeXhr.responseText = 'Internal Server Error'

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    await Promise.resolve()
    fakeXhr.trigger('load')
    const result = await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Upload failed (HTTP 500)')
    }
  })

  it('should return error on XHR network error event', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    await Promise.resolve()
    fakeXhr.trigger('error')
    const result = await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Network error during upload.')
    }
  })

  it('should return error on XHR abort event', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file)
    await Promise.resolve()
    fakeXhr.trigger('abort')
    const result = await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Upload cancelled.')
    }
  })
})

describe('uploadImage — progress callback', () => {
  it('should call onProgress with percentage when a progress event fires', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()
    fakeXhr.status = 200
    fakeXhr.responseText = JSON.stringify({ url: '/uploads/image.png' })

    const onProgress = vi.fn()

    // Capture the progress listener registered on xhr.upload
    let progressListener: ((e: ProgressEvent) => void) | undefined
    fakeXhr.upload.addEventListener.mockImplementation(
      (event: string, cb: (e: ProgressEvent) => void) => {
        if (event === 'progress') progressListener = cb
      },
    )

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file, onProgress)
    await Promise.resolve()

    // Fire progress event with 50% loaded
    progressListener?.({ lengthComputable: true, loaded: 512, total: 1024 } as ProgressEvent)

    fakeXhr.trigger('load')
    await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it('should not call onProgress when lengthComputable is false', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    withAuth()
    const file = makeFile()
    fakeXhr.status = 200
    fakeXhr.responseText = JSON.stringify({ url: '/uploads/image.png' })

    const onProgress = vi.fn()

    let progressListener: ((e: ProgressEvent) => void) | undefined
    fakeXhr.upload.addEventListener.mockImplementation(
      (event: string, cb: (e: ProgressEvent) => void) => {
        if (event === 'progress') progressListener = cb
      },
    )

    // ── act ──────────────────────────────────────────────────────────────────
    const promise = uploadImage(file, onProgress)
    await Promise.resolve()

    progressListener?.({ lengthComputable: false, loaded: 0, total: 0 } as ProgressEvent)

    fakeXhr.trigger('load')
    await promise

    // ── assert ────────────────────────────────────────────────────────────────
    expect(onProgress).not.toHaveBeenCalled()
  })
})
