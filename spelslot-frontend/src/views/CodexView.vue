<script setup lang="ts">
// Placeholder — Codex feature built in step 5
</script>

<template>
  <div class="placeholder">
    <div class="placeholder__card">
      <i class="pi pi-book placeholder__icon" aria-hidden="true" />
      <h1 class="placeholder__title">Codex</h1>
      <p class="placeholder__text">Coming soon — worldbuilding entries, lore, and locations.</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.placeholder__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 3rem;
  background-color: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  box-shadow: var(--ss-shadow-sm);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.placeholder__icon {
  font-size: 2.5rem;
  color: var(--ss-primary);
  opacity: 0.6;
}

.placeholder__title {
  margin: 0;
  font-size: 1.5rem;
  color: var(--ss-text);
}

.placeholder__text {
  margin: 0;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
