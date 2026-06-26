import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import checker from 'vite-plugin-checker'
import { fileURLToPath, URL } from 'node:url'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Generates public/firebase-messaging-sw.js with env vars baked in.
// Service workers can't use Vite's import.meta.env, so we write the
// config directly into the file at build/dev-start time.
function firebaseSwPlugin(): Plugin {
  let root = ''

  function writeSW(env: Record<string, string>) {
    const cfg = {
      apiKey: env.VITE_FIREBASE_API_KEY ?? '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: env.VITE_FIREBASE_APP_ID ?? '',
    }

    const content = `\
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp(${JSON.stringify(cfg, null, 2)})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Spelslot'
  const body  = payload.notification?.body  ?? ''
  const link  = payload.fcmOptions?.link    ?? '/'
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { link },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const target = event.notification.data?.link ?? '/'
      const match = list.find((c) => c.url.includes(target))
      if (match) return match.focus()
      return clients.openWindow(target)
    })
  )
})
`
    const publicDir = resolve(root, 'public')
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(resolve(publicDir, 'firebase-messaging-sw.js'), content)
  }

  return {
    name: 'firebase-messaging-sw',
    configResolved(config) {
      root = config.root
      writeSW(config.env as Record<string, string>)
    },
  }
}

// Vitest loads this config too; skip the checker there since `npm run test`
// already runs vue-tsc explicitly.
const isVitest = !!process.env.VITEST

export default defineConfig({
  plugins: [
    vue(),
    firebaseSwPlugin(),
    // Runs vue-tsc (types + templates) in a worker during `vite`/`vite preview`
    // and surfaces errors in the browser overlay + terminal as you save.
    ...(isVitest
      ? []
      : [
          checker({
            vueTsc: true,
            enableBuild: false,
          }),
        ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Force all @tiptap and yjs packages to resolve from spelslot-frontend/node_modules
    // (not from the monorepo root). Needed because npm hoists some Tiptap packages to
    // root while peers stay in the workspace, causing esbuild to fail cross-workspace.
    dedupe: [
      '@tiptap/core',
      '@tiptap/pm',
      '@tiptap/y-tiptap',
      '@tiptap/extension-collaboration',
      '@tiptap/starter-kit',
      '@tiptap/vue-3',
      '@hocuspocus/provider',
      'yjs',
      'y-protocols',
      'vue',
    ],
  },
  build: {
    target: 'esnext',
  },
})
