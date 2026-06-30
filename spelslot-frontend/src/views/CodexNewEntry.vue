<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import InputChips from 'primevue/inputchips'
import ToggleSwitch from 'primevue/toggleswitch'
import { codexService, type EntryType } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()

const router = useRouter()
const auth = useAuthStore()

const saving = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  name: '',
  type: 'lore' as EntryType,
  permission: 'PUBLIC' as 'PUBLIC' | 'DM_ONLY',
  tags: [] as string[],
  summary: '',
})

const TYPE_OPTIONS = computed(() => [
  { label: t('codex.types.lore'), value: 'lore' },
  { label: t('codex.types.location'), value: 'location' },
  { label: t('codex.types.npc'), value: 'npc' },
  { label: t('codex.types.faction'), value: 'faction' },
  { label: t('codex.types.item'), value: 'item' },
  { label: t('codex.types.event'), value: 'event' },
  { label: t('codex.types.rule'), value: 'rule' },
  { label: t('codex.types.session'), value: 'session' },
])

const isDmOnly = computed({
  get: () => form.permission === 'DM_ONLY',
  set: (v: boolean) => { form.permission = v ? 'DM_ONLY' : 'PUBLIC' },
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
        <h1 class="new-entry__title">{{ $t('codex.newEntryForm.pageTitle') }}</h1>
      </div>

      <div v-if="error" class="new-entry__error">
        <i class="pi pi-exclamation-circle" /> {{ error }}
      </div>

      <form class="new-entry__form" @submit.prevent="submit">
        <!-- Name -->
        <div class="form-field form-field--required">
          <label class="form-label">{{ $t('codex.newEntryForm.titleLabel') }}</label>
          <InputText
            v-model="form.name"
            :placeholder="$t('codex.newEntryForm.titlePlaceholder')"
            class="form-input"
            required
            autofocus
          />
        </div>

        <!-- Type + Permission -->
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">{{ $t('codex.newEntryForm.typeLabel') }}</label>
            <Select
              v-model="form.type"
              :options="TYPE_OPTIONS"
              option-label="label"
              option-value="value"
              class="form-input"
            />
          </div>
          <div v-if="auth.effectiveUser?.isStoryDm" class="form-field">
            <label class="form-label">{{ $t('codex.newEntryForm.visibilityLabel') }}</label>
            <div class="form-dm-row">
              <ToggleSwitch v-model="isDmOnly" input-id="new-perm-dm-only" />
              <label for="new-perm-dm-only" class="form-dm-label">{{ $t('codex.permission.dmOnly') }}</label>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="form-field">
          <label class="form-label"
            >{{ $t('codex.newEntryForm.summaryLabel') }}
            <span class="form-optional">{{ $t('codex.newEntryForm.summaryOptional') }}</span></label
          >
          <Textarea
            v-model="form.summary"
            :rows="3"
            auto-resize
            :placeholder="$t('codex.newEntryForm.summaryPlaceholder')"
            class="form-input"
          />
        </div>

        <!-- Tags -->
        <div class="form-field">
          <label class="form-label"
            >{{ $t('codex.newEntryForm.tagsLabel') }}
            <span class="form-optional">{{ $t('codex.newEntryForm.tagsOptional') }}</span></label
          >
          <InputChips
            v-model="form.tags"
            :placeholder="$t('codex.newEntryForm.tagsPlaceholder')"
            class="form-input"
          />
        </div>

        <div class="new-entry__actions">
          <Button
            type="submit"
            :label="$t('codex.newEntryForm.submitLabel')"
            icon="pi pi-plus"
            :loading="saving"
            :disabled="!form.name.trim()"
          />
          <Button :label="$t('common.cancel')" text severity="secondary" @click="router.back()" />
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

.form-row .form-field {
  flex: 1;
  min-width: 180px;
}

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

.form-field--required .form-label::after {
  content: ' *';
  color: var(--ss-primary);
}
.form-optional {
  font-weight: 400;
  opacity: 0.7;
}

.form-input {
  width: 100%;
}

.form-dm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
}

.form-dm-label {
  font-size: 0.875rem;
  color: var(--ss-text);
  cursor: pointer;
}

.new-entry__actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
</style>
