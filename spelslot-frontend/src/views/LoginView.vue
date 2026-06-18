<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)

async function signInWithGoogle() {
  if (loading.value) return
  loading.value = true
  error.value = null

  const result = await auth.loginWithGoogle()
  loading.value = false

  if (result.type === 'error') {
    error.value = result.message
    return
  }

  await router.push('/')
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">Spelslot</h1>
      <p class="login__sub">D&amp;D club management platform</p>

      <Button
        label="Sign in with Google"
        icon="pi pi-google"
        :loading="loading"
        class="login__button"
        @click="signInWithGoogle"
      />

      <p v-if="error" class="login__error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--ss-parchment);
}

.login__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2.5rem 3rem;
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  box-shadow: var(--ss-shadow);
  width: 100%;
  max-width: 360px;
}

.login__title {
  margin: 0;
  font-size: 2rem;
  color: var(--ss-primary);
}

.login__sub {
  margin: 0;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.login__button {
  width: 100%;
  margin-top: 0.5rem;
}

.login__error {
  margin: 0;
  color: var(--ss-danger);
  font-size: 0.875rem;
}
</style>
