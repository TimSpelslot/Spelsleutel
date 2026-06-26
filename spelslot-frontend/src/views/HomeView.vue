<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await auth.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="home">
    <div class="home__card">
      <h1 class="home__title">{{ $t('home.title') }}</h1>
      <p class="home__welcome">
        {{ $t('home.welcome', { name: auth.user?.displayName ?? auth.user?.name }) }}
      </p>
      <p class="home__role">{{ auth.user?.role }}</p>
      <Button
        :label="$t('common.signOut')"
        severity="secondary"
        icon="pi pi-sign-out"
        class="home__logout"
        @click="handleLogout"
      />
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--ss-parchment);
}

.home__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 3rem;
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  box-shadow: var(--ss-shadow);
}

.home__title {
  margin: 0;
  font-size: 2rem;
  color: var(--ss-primary);
}

.home__welcome {
  margin: 0;
  color: var(--ss-text);
}

.home__role {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.home__logout {
  margin-top: 0.5rem;
}
</style>
