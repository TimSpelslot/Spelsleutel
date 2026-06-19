<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import InputChips from 'primevue/inputchips'
import { codexService, type EntryType } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const saving = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  name: '',
  type: 'lore' as EntryType,
  permission: 'PLAYERS' as 'PUBLIC' | 'PLAYERS' | 'DM_ONLY' | 'PRIVATE',
  tags: [] as string[],
  summary: '',
})

const TYPE_OPTIONS = [
  { label: 'Lore', value: 'lore' },
  { label: 'Location', value: 'location' },
  { label: 'NPC', value: 'npc' },
  { label: 'Faction', value: 'faction' },
  { label: 'Item', value: 'item' },
  { label: 'Event', value: 'event' },
  { label: 'Rule', value: 'rule' },
  { label: 'Session', value: 'session' },
]

const permissionOptions = computed(() => {
  const opts: { label: string; value: string }[] = [
    { label: 'Public', value: 'PUBLIC' },
    { label: 'Players', value: 'PLAYERS' },
    { label: 'Private', value: 'PRIVATE' },
  ]
  if (auth.user?.role === 'DM' || auth.user?.role === 'ADMIN') {
    opts.splice(2, 0, { label: 'DM Only', value: 'DM_ONLY' })
  }
  return opts
})

async function submit() {
  if (!form.name.trim()) return
  saving.value = true
  error.value = null
  const result = await codexService.createEntry({
    name: form.name.trim(),
    type: form.type,
    permission: form.permission,
    tags: form.tags,
    summary: form.summary,
  })
  saving.value = false
  if (result.type === 'ok') {
    router.push({ name: 'codex', query: { entry: result.data.slug } })
  } else {
    error.value = result.message
  }
}
</script>

<template>
  <div class="new-entry">
    <div class="new-entry__card">
      <div class="new-entry__header">
        <Button
          icon="pi pi-arrow-left"
          text
          severity="secondary"
          size="small"
          @click="router.back()"
        />
        <h1 class="new-entry__title">New Codex Entry</h1>
      </div>

      <div v-if="error" class="new-entry__error">
        <i class="pi pi-exclamation-circle" /> {{ error }}
      </div>

      <form class="new-entry__form" @submit.prevent="submit">
        <!-- Name -->
        <div class="form-field form-field--required">
          <label class="form-label">Title</label>
          <InputText
            v-model="form.name"
            placeholder="Entry name…"
            class="form-input"
            required
            autofocus
          />
        </div>

        <!-- Type + Permission -->
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Type</label>
            <Select
              v-model="form.type"
              :options="TYPE_OPTIONS"
              option-label="label"
              option-value="value"
              class="form-input"
            />
          </div>
          <div class="form-field">
            <label class="form-label">Visibility</label>
            <Select
              v-model="form.permission"
              :options="permissionOptions"
              option-label="label"
              option-value="value"
              class="form-input"
            />
          </div>
        </div>

        <!-- Summary -->
        <div class="form-field">
          <label class="form-label">Summary <span class="form-optional">(optional)</span></label>
          <Textarea
            v-model="form.summary"
            :rows="3"
            auto-resize
            placeholder="Short description shown in the tree and previews…"
            class="form-input"
          />
        </div>

        <!-- Tags -->
        <div class="form-field">
          <label class="form-label">Tags <span class="form-optional">(optional)</span></label>
          <InputChips v-model="form.tags" placeholder="Add tag, press Enter…" class="form-input" />
        </div>

        <div class="new-entry__actions">
          <Button
            type="submit"
            label="Create entry"
            icon="pi pi-plus"
            :loading="saving"
            :disabled="!form.name.trim()"
          />
          <Button
            label="Cancel"
            text
            severity="secondary"
            @click="router.back()"
          />
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.new-entry {
  padding: 2rem;
  max-width: 680px;
  margin: 0 auto;
}

.new-entry__card {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1.75rem;
}

.new-entry__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.new-entry__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--ss-text);
}

.new-entry__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.6rem 0.9rem;
  background: color-mix(in srgb, var(--ss-danger, #ef4444) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-danger, #ef4444) 30%, transparent);
  border-radius: var(--ss-radius);
  color: var(--ss-danger, #ef4444);
  font-size: 0.875rem;
}

.new-entry__form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-row .form-field { flex: 1; min-width: 180px; }

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ss-text-muted);
}

.form-field--required .form-label::after { content: ' *'; color: var(--ss-primary); }
.form-optional { font-weight: 400; opacity: 0.7; }

.form-input { width: 100%; }

.new-entry__actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
</style>
