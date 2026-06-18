import { ref, reactive } from 'vue'

// Module-level refs so all callers share a single sidebar state
const collapsed = ref(false)
const mobileOpen = ref(false)

export function useSidebar() {
  function toggle() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      mobileOpen.value = !mobileOpen.value
    } else {
      collapsed.value = !collapsed.value
    }
  }

  function closeMobile() {
    mobileOpen.value = false
  }

  // reactive() so sidebar.collapsed unwraps the ref in templates
  return reactive({ collapsed, mobileOpen, toggle, closeMobile })
}
