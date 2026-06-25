import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import { spelslotPreset } from '@/theme/spelslotPreset'
import { createPinia } from 'pinia'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import 'tippy.js/dist/tippy.css'
import router from '@/router'
import App from './App.vue'
import '@/assets/tokens.css'
import { initColorScheme } from '@/composables/useColorScheme'
import { useAuthStore } from '@/stores/auth'

// Apply the persisted (or system) light/dark choice before mount to avoid a flash.
initColorScheme()

const app = createApp(App)

// Registration order per conventions: PrimeVue → Pinia → services → directives
app.use(PrimeVue, {
  theme: {
    preset: spelslotPreset,
    options: {
      // Dark mode toggles via a `.ss-dark` class on <html> (managed by useColorScheme).
      darkModeSelector: '.ss-dark',
      // Wrap all PrimeVue styles in an @layer named `primevue`. Our app CSS (scoped
      // component styles + tokens.css) stays unlayered, and unlayered styles always
      // beat layered ones — so app overrides win with no specificity hacks / !important.
      cssLayer: { name: 'primevue', order: 'primevue' },
    },
  },
})
const pinia = createPinia()
app.use(pinia)
app.use(ConfirmationService)
app.use(ToastService)
app.directive('tooltip', Tooltip)

// Await first auth state check before adding router so guards never fire against uninitialised state
const auth = useAuthStore()
await auth.init()

app.use(router)
app.mount('#app')
