import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

function withSetup<T>(composableFn: () => T): { result: T; unmount: () => void } {
  let result!: T
  const TestComponent = defineComponent({
    setup() {
      result = composableFn()
      return () => h('div')
    },
  })
  const wrapper = mount(TestComponent)
  return { result, unmount: () => wrapper.unmount() }
}

type ChangeHandler = (e: { matches: boolean }) => void

function makeMatchMedia(matches: boolean) {
  let changeHandler: ChangeHandler | null = null
  const mq = {
    matches,
    addEventListener: vi.fn((_event: string, handler: ChangeHandler) => {
      changeHandler = handler
    }),
    removeEventListener: vi.fn(),
    mockTrigger(newMatches: boolean) {
      changeHandler?.({ matches: newMatches })
    },
  }
  return mq
}

beforeEach(() => {
  vi.restoreAllMocks()
})

import { useIsMobile } from './useIsMobile'

describe('useIsMobile initial value', () => {
  it('should be true when matchMedia matches is true', () => {
    const mq = makeMatchMedia(true)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mq),
    )

    const { result } = withSetup(() => useIsMobile())

    expect(result.value).toBe(true)
  })

  it('should be false when matchMedia matches is false', () => {
    const mq = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mq),
    )

    const { result } = withSetup(() => useIsMobile())

    expect(result.value).toBe(false)
  })
})

describe('useIsMobile custom breakpoint', () => {
  it('should use the provided breakpoint in the media query string', () => {
    const matchMediaMock = vi.fn(() => makeMatchMedia(false))
    vi.stubGlobal('matchMedia', matchMediaMock)

    withSetup(() => useIsMobile(1024))

    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 1024px)')
  })
})

describe('useIsMobile change event', () => {
  it('should update isMobile when the change event fires', () => {
    const mq = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mq),
    )

    const { result } = withSetup(() => useIsMobile())

    expect(result.value).toBe(false)

    mq.mockTrigger(true)

    expect(result.value).toBe(true)
  })
})

describe('useIsMobile unmount cleanup', () => {
  it('should call removeEventListener when the component unmounts', () => {
    const mq = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mq),
    )

    const { unmount } = withSetup(() => useIsMobile())

    unmount()

    expect(mq.removeEventListener).toHaveBeenCalled()
  })
})
