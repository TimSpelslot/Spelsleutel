import { ref, reactive, computed } from 'vue'

/**
 * Light/dark colour scheme state.
 *
 * Toggling sets a `.ss-dark` class on <html>, which is the `darkModeSelector`
 * configured for PrimeVue in main.ts. Because every `--ss-*` token aliases a
 * PrimeVue `--p-*` variable (see tokens.css), the whole UI — PrimeVue components
 * and custom CSS alike — switches in one step.
 *
 * The choice is persisted to localStorage; with no stored choice we follow the OS.
 */
const STORAGE_KEY = 'ss-color-scheme'
const DARK_CLASS = 'ss-dark'

// Module-level ref so all callers share a single scheme state.
const isDark = ref(false)

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function storedChoice(): 'light' | 'dark' | null {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return v === 'light' || v === 'dark' ? v : null
}

function applyClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(DARK_CLASS, isDark.value)
}

/**
 * Apply the persisted (or system) scheme. Call once at startup, before mount,
 * so there is no flash of the wrong theme.
 */
export function initColorScheme() {
  isDark.value = storedChoice() === null ? systemPrefersDark() : storedChoice() === 'dark'
  applyClass()

  // Follow the OS while the user hasn't made an explicit choice.
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (storedChoice() === null) {
        isDark.value = e.matches
        applyClass()
      }
    })
  }
}

export function useColorScheme() {
  function setScheme(scheme: 'light' | 'dark') {
    isDark.value = scheme === 'dark'
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, scheme)
    applyClass()
  }

  function toggle() {
    setScheme(isDark.value ? 'light' : 'dark')
  }

  const scheme = computed<'light' | 'dark'>(() => (isDark.value ? 'dark' : 'light'))

  return reactive({ isDark, scheme, toggle, setScheme })
}
