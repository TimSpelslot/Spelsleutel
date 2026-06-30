<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { instantModeService, type InstantModeRange } from '@/services/instantModeService'

const toast = useToast()

const ranges = ref<InstantModeRange[]>([])
const isCurrentlyActive = ref(false)
const loading = ref(false)

// New range form
const newLabel = ref('')
const newIsRecurring = ref(false)
const newStartDate = ref('')
const newEndDate = ref('')
const newWeekday = ref<number | null>(null)
const newWeekOfMonth = ref<number | null>(null)
const saving = ref(false)

const WEEKDAY_OPTIONS = [
  { label: 'Maandag', value: 0 },
  { label: 'Dinsdag', value: 1 },
  { label: 'Woensdag', value: 2 },
  { label: 'Donderdag', value: 3 },
  { label: 'Vrijdag', value: 4 },
  { label: 'Zaterdag', value: 5 },
  { label: 'Zondag', value: 6 },
]

const WEEK_OF_MONTH_OPTIONS = [
  { label: '1e week', value: 1 },
  { label: '2e week', value: 2 },
  { label: '3e week', value: 3 },
  { label: '4e week', value: 4 },
  { label: '5e week', value: 5 },
]

const isFormValid = computed(() => {
  if (newIsRecurring.value) return true
  return !!newStartDate.value
})

async function load() {
  loading.value = true
  const [listResult, checkResult] = await Promise.all([
    instantModeService.list(),
    instantModeService.check(),
  ])
  if (listResult.type === 'ok') ranges.value = listResult.data
  if (checkResult.type === 'ok') isCurrentlyActive.value = checkResult.data
  loading.value = false
}

async function addRange() {
  if (!isFormValid.value) return
  saving.value = true
  const result = await instantModeService.create({
    label: newLabel.value || null,
    isRecurring: newIsRecurring.value,
    startDate: newIsRecurring.value ? null : newStartDate.value || null,
    endDate: newIsRecurring.value ? null : newEndDate.value || null,
    recurrenceWeekday: newIsRecurring.value ? newWeekday.value : null,
    recurrenceWeekOfMonth: newIsRecurring.value ? newWeekOfMonth.value : null,
  })
  if (result.type === 'ok') {
    ranges.value.unshift(result.data)
    newLabel.value = ''
    newStartDate.value = ''
    newEndDate.value = ''
    newWeekday.value = null
    newWeekOfMonth.value = null
    newIsRecurring.value = false
    const checkResult = await instantModeService.check()
    if (checkResult.type === 'ok') isCurrentlyActive.value = checkResult.data
    toast.add({ severity: 'success', summary: 'Instant mode periode toegevoegd', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
  saving.value = false
}

async function deleteRange(id: string) {
  const result = await instantModeService.remove(id)
  if (result.type === 'ok') {
    ranges.value = ranges.value.filter((r) => r.id !== id)
    const checkResult = await instantModeService.check()
    if (checkResult.type === 'ok') isCurrentlyActive.value = checkResult.data
    toast.add({ severity: 'success', summary: 'Periode verwijderd', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: result.message, life: 5000 })
  }
}

function formatRange(r: InstantModeRange): string {
  if (r.isRecurring) {
    const day = r.recurrenceWeekday !== null ? WEEKDAY_OPTIONS[r.recurrenceWeekday]?.label : '?'
    const week = r.recurrenceWeekOfMonth !== null ? `${r.recurrenceWeekOfMonth}e week` : 'elke week'
    return `Herhalend: ${day ?? '?'} (${week})`
  }
  const start = r.startDate ? new Date(r.startDate).toLocaleDateString('nl-NL') : '?'
  const end = r.endDate ? new Date(r.endDate).toLocaleDateString('nl-NL') : 'doorlopend'
  return `${start} – ${end}`
}

onMounted(load)
</script>

<template>
  <div class="im-view">
    <div class="im-header">
      <h1 class="im-title">Instant mode beheer</h1>
      <span class="im-status" :class="isCurrentlyActive ? 'im-status--active' : 'im-status--inactive'">
        <i class="pi" :class="isCurrentlyActive ? 'pi-bolt' : 'pi-circle'" />
        {{ isCurrentlyActive ? 'Nu actief' : 'Niet actief' }}
      </span>
    </div>

    <p class="im-desc">
      Tijdens instant mode kunnen spelers zich direct aanmelden voor een sessie en worden ze meteen ingedeeld (geen zondagse loting). Sessies die worden aangemaakt tijdens instant mode worden automatisch uitgesloten van karma.
    </p>

    <!-- Add range form -->
    <section class="im-section">
      <h2 class="im-section-heading">Periode toevoegen</h2>

      <div class="im-form">
        <div class="im-field">
          <label class="im-label">Label (optioneel)</label>
          <InputText v-model="newLabel" placeholder="bijv. Zomervakantie" class="im-input" />
        </div>

        <div class="im-field im-field--toggle">
          <label class="im-label">Herhalend</label>
          <ToggleSwitch v-model="newIsRecurring" />
        </div>

        <template v-if="newIsRecurring">
          <div class="im-field">
            <label class="im-label">Dag van de week</label>
            <Select
              v-model="newWeekday"
              :options="WEEKDAY_OPTIONS"
              option-label="label"
              option-value="value"
              placeholder="Kies dag"
              class="im-input"
            />
          </div>
          <div class="im-field">
            <label class="im-label">Week van de maand</label>
            <Select
              v-model="newWeekOfMonth"
              :options="WEEK_OF_MONTH_OPTIONS"
              option-label="label"
              option-value="value"
              placeholder="Kies week (leeg = elke week)"
              class="im-input"
            />
          </div>
        </template>

        <template v-else>
          <div class="im-field">
            <label class="im-label">Startdatum</label>
            <InputText v-model="newStartDate" type="date" class="im-input" />
          </div>
          <div class="im-field">
            <label class="im-label">Einddatum (optioneel)</label>
            <InputText v-model="newEndDate" type="date" class="im-input" />
          </div>
        </template>

        <Button
          label="Toevoegen"
          icon="pi pi-plus"
          :disabled="!isFormValid || saving"
          :loading="saving"
          @click="addRange"
        />
      </div>
    </section>

    <!-- Existing ranges -->
    <section class="im-section">
      <h2 class="im-section-heading">Bestaande periodes</h2>

      <div v-if="loading" class="im-empty">Laden…</div>
      <div v-else-if="ranges.length === 0" class="im-empty">Geen instant mode periodes ingesteld.</div>

      <ul v-else class="im-list">
        <li v-for="range in ranges" :key="range.id" class="im-item">
          <div class="im-item-info">
            <span class="im-item-label">{{ range.label || '(geen label)' }}</span>
            <span class="im-item-range">{{ formatRange(range) }}</span>
          </div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            @click="deleteRange(range.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.im-view {
  padding: 1.5rem;
  max-width: 720px;
  margin: 0 auto;
}

.im-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.im-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

.im-status {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
}

.im-status--active {
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  color: var(--ss-primary);
}

.im-status--inactive {
  background: var(--ss-surface-raised);
  color: var(--ss-text-muted);
}

.im-desc {
  color: var(--ss-text-muted);
  font-size: 0.9rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.im-section {
  margin-bottom: 2rem;
}

.im-section-heading {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ss-text);
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ss-border);
}

.im-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 440px;
}

.im-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.im-field--toggle {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}

.im-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.im-input {
  width: 100%;
}

.im-empty {
  color: var(--ss-text-muted);
  font-size: 0.9rem;
  padding: 1rem 0;
}

.im-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.im-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--ss-surface-raised);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.im-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.im-item-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ss-text);
}

.im-item-range {
  font-size: 0.82rem;
  color: var(--ss-text-muted);
}
</style>
