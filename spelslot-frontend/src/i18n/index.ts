import { createI18n } from 'vue-i18n'

// Recursive message tree: namespace → key → string (or nested group).
type Messages = { [key: string]: string | Messages }

// Locale messages are split into one JSON file per feature namespace under
// `locales/<locale>/` (e.g. `en/common.json` → `en.common.*`). They're auto-merged
// here by locale folder + filename, so BOTH adding a namespace AND adding a whole
// locale (drop in `locales/nl/`) is picked up automatically — no edit here required.
const modules = import.meta.glob('./locales/*/*.json', { eager: true })

const messages: Record<string, Messages> = {}
for (const path in modules) {
  // path looks like './locales/en/common.json'
  const [, locale, namespace] = path.match(/\.\/locales\/([^/]+)\/(.+)\.json$/)!
  ;(messages[locale] ??= {})[namespace] = (modules[path] as { default: Messages }).default
}

// Locales the UI offers in the language switcher. Order = display order.
export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

const STORAGE_KEY = 'ss-locale'
const DEFAULT_LOCALE: LocaleCode = 'en'

function isSupported(code: string | null): code is LocaleCode {
  return !!code && SUPPORTED_LOCALES.some((l) => l.code === code)
}

/** Resolve the startup locale: persisted choice → browser language → default. */
function initialLocale(): LocaleCode {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (isSupported(stored)) return stored
  const browser = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : null
  if (isSupported(browser)) return browser
  return DEFAULT_LOCALE
}

// `locale` is reactive (legacy:false), so switching `i18n.global.locale.value`
// updates the whole UI live. fallbackLocale fills any keys missing from the
// active locale (handy while a translation is still incomplete).
export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

/** Persist + apply a locale. Also keeps <html lang> in sync for a11y/SEO. */
export function setLocale(code: LocaleCode) {
  i18n.global.locale.value = code
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, code)
  if (typeof document !== 'undefined') document.documentElement.lang = code
}

// Reflect the resolved startup locale onto <html lang> immediately.
if (typeof document !== 'undefined') document.documentElement.lang = i18n.global.locale.value

// For use OUTSIDE component setup (services, stores, router) where useI18n()
// is unavailable. Inside components use `$t` (templates) or `useI18n()`.
export const t = i18n.global.t
