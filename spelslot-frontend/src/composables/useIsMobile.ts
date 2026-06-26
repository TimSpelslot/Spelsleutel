import { ref, onMounted, onUnmounted } from 'vue'

export function useIsMobile(breakpoint = 767) {
  const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
  const isMobile = ref(mq.matches)

  function update(e: MediaQueryListEvent) {
    isMobile.value = e.matches
  }

  onMounted(() => mq.addEventListener('change', update))
  onUnmounted(() => mq.removeEventListener('change', update))

  return isMobile
}
