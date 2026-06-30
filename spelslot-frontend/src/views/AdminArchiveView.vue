<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { codexService, type CodexEntry } from '@/services/codexService'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const auth = useAuthStore()
const entries = ref<CodexEntry[]>([])
const loading = ref(false)
const confirmingDeleteId = ref<string | null>(null)

const canAccess = computed(() => {
  const u = auth.effectiveUser
  return u?.role === 'ADMIN' && u?.isWorldbuilder
})

const visibleEntries = computed(() => {
  if (!auth.effectiveUser?.isStoryDm) {
    return entries.value.filter(e => e.permission !== 'DM_ONLY')
  }
  return entries.value
})

onMounted(async () => {
  if (!canAccess.value) return
  loading.value = true
  const result = await codexService.listArchive()
  loading.value = false
  if (result.type === 'ok') entries.value = result.data
})

async function restore(entry: CodexEntry) {
  const result = await codexService.restoreEntry(entry.id)
  if (result.type === 'ok') {
    entries.value = entries.value.filter(e => e.id !== entry.id)
  }
}

async function permanentDelete(entry: CodexEntry) {
  if (confirmingDeleteId.value !== entry.id) {
    confirmingDeleteId.value = entry.id
    return
  }
  const result = await codexService.permanentDeleteEntry(entry.id)
  if (result.type === 'ok') {
    entries.value = entries.value.filter(e => e.id !== entry.id)
    confirmingDeleteId.value = null
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="archive-view">
    <div class="archive-view__header">
      <h1 class="archive-view__title">Codex Archief</h1>
    </div>

    <div v-if="!canAccess" class="archive-access-denied">
      <i class="pi pi-lock" />
      <p>Je hebt geen toegang tot dit scherm. Alleen admins met worldbuilder-toegang kunnen het archief beheren.</p>
    </div>

    <template v-else>
      <div v-if="loading" class="archive-loading">
        <i class="pi pi-spin pi-spinner" /> Laden...
      </div>

      <div v-else-if="visibleEntries.length === 0" class="archive-empty">
        <i class="pi pi-inbox" />
        <p>Het archief is leeg.</p>
      </div>

      <DataTable
        v-else
        :value="visibleEntries"
        size="small"
        striped-rows
        class="archive-table"
      >
        <Column header="Naam" style="min-width: 200px">
          <template #body="{ data }">
            <span class="archive-table__name">{{ data.name }}</span>
          </template>
        </Column>

        <Column header="Type" style="width: 120px">
          <template #body="{ data }">
            <span class="archive-table__type">{{ data.type }}</span>
          </template>
        </Column>

        <Column header="Zichtbaarheid" style="width: 130px">
          <template #body="{ data }">
            <Tag
              v-if="data.permission === 'DM_ONLY'"
              value="DM Only"
              severity="warn"
            />
            <span v-else class="archive-table__perm">{{ data.permission }}</span>
          </template>
        </Column>

        <Column header="Gearchiveerd op" style="width: 160px">
          <template #body="{ data }">
            <span class="archive-table__date">{{ formatDate(data.updatedAt) }}</span>
          </template>
        </Column>

        <Column style="width: 200px; text-align: right">
          <template #body="{ data }">
            <div class="archive-table__actions">
              <Button
                label="Herstellen"
                icon="pi pi-undo"
                size="small"
                severity="secondary"
                outlined
                @click="restore(data)"
              />
              <Button
                v-if="confirmingDeleteId === data.id"
                label="Zeker?"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                @click="permanentDelete(data)"
              />
              <Button
                v-else
                label="Verwijderen"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                outlined
                @click="permanentDelete(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.archive-view {
  max-width: 960px;
  padding: 1.5rem;
}

.archive-view__header {
  margin-bottom: 1.5rem;
}

.archive-view__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

.archive-access-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--ss-text-muted);
  text-align: center;
  font-size: 0.9rem;
}

.archive-access-denied .pi {
  font-size: 2rem;
  color: var(--ss-text-subtle);
}

.archive-loading {
  padding: 2rem;
  text-align: center;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.archive-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  border: 1px dashed var(--ss-border);
  border-radius: var(--ss-radius);
  color: var(--ss-text-muted);
  text-align: center;
}

.archive-empty .pi {
  font-size: 2rem;
  color: var(--ss-text-subtle);
}

.archive-empty p {
  margin: 0;
  font-size: 0.875rem;
}

.archive-table {
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.archive-table__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ss-text);
}

.archive-table__type {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  text-transform: capitalize;
}

.archive-table__perm {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.archive-table__date {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.archive-table__actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}
</style>
