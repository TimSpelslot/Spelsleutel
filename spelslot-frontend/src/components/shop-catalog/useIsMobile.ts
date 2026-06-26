import { ref, onMounted, onUnmounted, readonly } from 'vue'

/** Matches the marketplace mobile breakpoint (< 768px). */
const MOBILE_BREAKPOINT = 768

/**
 * Reactive `isMobile` flag driven by the viewport width. Self-contained so the
 * catalog folder carries no dependency on the host's composables.
 */
export function useIsMobile() {
  const isMobile = ref(false)

  function update() {
    isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return { isMobile: readonly(isMobile) }
}
