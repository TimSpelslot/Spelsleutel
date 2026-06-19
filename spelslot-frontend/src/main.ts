import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { createPinia } from 'pinia'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import 'tippy.js/dist/tippy.css'
import router from '@/router'
import App from './App.vue'
import '@/assets/tokens.css'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)

// Registration order per conventions: PrimeVue → Pinia → services → directives
app.use(PrimeVue, { theme: { preset: Aura } })
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
