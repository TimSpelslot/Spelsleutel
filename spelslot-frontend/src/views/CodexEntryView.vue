<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TiptapRenderer from '@/components/codex/TiptapRenderer.vue'
import { codexService, type CodexEntryDetail, type EntryType } from '@/services/codexService'

const route = useRoute()
const router = useRouter()

const detail = ref<CodexEntryDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const activeDocIndex = ref(0)

async function loadEntry(slug: string) {
  loading.value = true
  error.value = null
  activeDocIndex.value = 0
  const result = await codexService.getBySlug(slug)
  loading.value = false
  if (result.type === 'ok') detail.value = result.data
  else error.value = result.message
}

onMounted(() => loadEntry(route.params.slug as string))
watch(() => route.params.slug, (s) => { if (s) loadEntry(s as string) })

// ── Derived ───────────────────────────────────────────────────────────────

const entry = computed(() => detail.value?.entry)
const documents = computed(() => detail.value?.documents ?? [])
const relations = computed(() => detail.value?.relations ?? [])
const visibleDocs = computed(() => documents.value.filter((d) => !d.isHidden))
const activeDoc = computed(() => visibleDocs.value[activeDocIndex.value] ?? null)

const TYPE_META: Record<EntryType, { label: string; icon: string; severity: string }> = {
  lore:     { label: 'Lore',     icon: 'pi-book',       severity: 'secondary' },
  location: { label: 'Location', icon: 'pi-map-marker',  severity: 'secondary' },
  npc:      { label: 'NPC',      icon: 'pi-user',        severity: 'secondary' },
  faction:  { label: 'Faction',  icon: 'pi-users',       severity: 'secondary' },
  item:     { label: 'Item',     icon: 'pi-star',        severity: 'warn' },
  event:    { label: 'Event',    icon: 'pi-calendar',    severity: 'secondary' },
  rule:     { label: 'Rule',     icon: 'pi-file',        severity: 'secondary' },
  session:  { label: 'Session',  icon: 'pi-play',        severity: 'contrast' },
}

const PERM_META: Record<string, { label: string; severity: string }> = {
  PUBLIC:   { label: 'Public',   severity: 'success' },
  PLAYERS:  { label: 'Players',  severity: 'secondary' },
  DM_ONLY:  { label: 'DM Only',  severity: 'warn' },
  PRIVATE:  { label: 'Private',  severity: 'danger' },
}

function typeMeta(type: EntryType) {
  return TYPE_META[type] ?? { label: type, icon: 'pi-circle', severity: 'secondary' }
}
</script>

<template>
  <div class="entry-view">
    <!-- Back -->
    <Button
      label="Codex"
      icon="pi pi-arrow-left"
      text
      size="small"
      class="entry-view__back"
      @click="router.push({ name: 'codex' })"
    />

    <!-- Loading -->
    <template v-if="loading">
      <Skeleton height="2rem" width="60%" class="entry-view__skel-title" />
      <Skeleton height="1rem" width="30%" />
      <div class="entry-view__skel-body">
        <Skeleton height="1rem" v-for="n in 6" :key="n" />
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="error" class="entry-view__empty entry-view__empty--error">
      <i class="pi pi-exclamation-circle entry-view__empty-icon" />
      <p class="entry-view__empty-text">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="entry">
      <!-- Banner -->
      <div
        v-if="entry.banner.enabled && entry.banner.url"
        class="entry-view__banner"
        :style="{ backgroundImage: `url(${entry.banner.url})`, backgroundPositionY: `${entry.banner.yPosition}%` }"
        role="img"
        :aria-label="`Banner for ${entry.name}`"
      />

      <!-- Header -->
      <div class="entry-view__header">
        <div class="entry-view__title-row">
          <h1 class="entry-view__title">{{ entry.name }}</h1>
          <div class="entry-view__badges">
            <Tag
              :value="typeMeta(entry.type).label"
              :severity="typeMeta(entry.type).severity"
              class="entry-view__type-tag"
            >
              <template #default>
                <i :class="['pi', typeMeta(entry.type).icon]" aria-hidden="true" />
                {{ typeMeta(entry.type).label }}
              </template>
            </Tag>
            <Tag
              v-if="entry.permission !== 'PLAYERS'"
              :value="PERM_META[entry.permission]?.label ?? entry.permission"
              :severity="PERM_META[entry.permission]?.severity ?? 'secondary'"
              class="entry-view__perm-tag"
            />
            <Tag v-if="entry.status === 'DRAFT'" value="Draft" severity="warn" />
            <Tag v-if="entry.isLocked" value="" severity="secondary">
              <template #default>
                <i class="pi pi-lock" aria-hidden="true" />
              </template>
            </Tag>
          </div>
        </div>

        <!-- Summary -->
        <p v-if="entry.summary" class="entry-view__summary">{{ entry.summary }}</p>

        <!-- Tags -->
        <div v-if="entry.tags.length" class="entry-view__tags">
          <span v-for="tag in entry.tags" :key="tag" class="entry-view__tag">{{ tag }}</span>
        </div>

        <!-- Aliases -->
        <p v-if="entry.aliases.length" class="entry-view__aliases">
          <span class="entry-view__aliases-label">Also known as:</span>
          {{ entry.aliases.join(', ') }}
        </p>
      </div>

      <!-- Document tabs -->
      <div v-if="visibleDocs.length" class="entry-view__docs">
        <div v-if="visibleDocs.length > 1" class="entry-view__tabs" role="tablist">
          <button
            v-for="(doc, i) in visibleDocs"
            :key="doc.id"
            role="tab"
            :aria-selected="activeDocIndex === i"
            class="entry-view__tab"
            :class="{ 'entry-view__tab--active': activeDocIndex === i }"
            @click="activeDocIndex = i"
          >
            {{ doc.name }}
          </button>
        </div>

        <div v-if="activeDoc" class="entry-view__doc-body">
          <!-- Page: render with Tiptap -->
          <TiptapRenderer
            v-if="activeDoc.type === 'page' && activeDoc.content"
            :content="activeDoc.content"
          />
          <!-- Other types: not rendered yet -->
          <div v-else-if="activeDoc.type !== 'page'" class="entry-view__unsupported">
            <i class="pi pi-clock" aria-hidden="true" />
            <p>{{ activeDoc.type.charAt(0).toUpperCase() + activeDoc.type.slice(1) }} viewer coming in v2.</p>
          </div>
          <div v-else class="entry-view__empty-doc">
            <p>This page is empty.</p>
          </div>
        </div>
      </div>

      <div v-else class="entry-view__no-docs">
        <p>No documents for this entry yet.</p>
      </div>

      <!-- Relations -->
      <div v-if="relations.length" class="entry-view__relations">
        <h2 class="entry-view__relations-heading">
          <i class="pi pi-link" aria-hidden="true" />
          Related Entries
        </h2>
        <div class="entry-view__relation-list">
          <div
            v-for="rel in relations"
            :key="rel.id"
            class="entry-view__relation"
          >
            <i
              :class="['pi', rel.direction === 'outgoing' ? 'pi-arrow-right' : 'pi-arrow-left']"
              class="entry-view__relation-dir"
              aria-hidden="true"
            />
            <span v-if="rel.type" class="entry-view__relation-type">{{ rel.type }}</span>
            <button
              v-if="rel.relatedEntry"
              class="entry-view__relation-link"
              @click="router.push({ name: 'codex-entry', params: { slug: rel.relatedEntry.slug } })"
            >
              {{ rel.relatedEntry.name }}
            </button>
            <span v-else class="entry-view__relation-unknown">Unknown entry</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.entry-view {
  max-width: 780px;
}

/* ── Back button ── */
.entry-view__back {
  margin-bottom: 1rem;
  padding-left: 0 !important;
  color: var(--ss-text-muted) !important;
}

/* ── Skeleton ── */
.entry-view__skel-title { margin-bottom: 0.5rem; }
.entry-view__skel-body {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ── Banner ── */
.entry-view__banner {
  width: 100%;
  height: 160px;
  background-size: cover;
  background-repeat: no-repeat;
  border-radius: var(--ss-radius-lg);
  margin-bottom: 1.25rem;
}

/* ── Header ── */
.entry-view__header {
  margin-bottom: 1.5rem;
}

.entry-view__title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.entry-view__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ss-text);
  flex: 1;
  min-width: 0;
}

.entry-view__badges {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.entry-view__type-tag :deep(.p-tag-value) {
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.entry-view__summary {
  margin: 0 0 0.75rem;
  color: var(--ss-text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

.entry-view__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.entry-view__tag {
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: 99px;
  padding: 0.1em 0.6em;
  font-size: 0.75rem;
  font-weight: 500;
}

.entry-view__aliases {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.entry-view__aliases-label {
  font-weight: 600;
  margin-right: 0.25em;
}

/* ── Document tabs ── */
.entry-view__docs {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.entry-view__tabs {
  display: flex;
  border-bottom: 1px solid var(--ss-border);
  overflow-x: auto;
  background: var(--ss-parchment-dark);
}

.entry-view__tab {
  padding: 0.6rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ss-text-muted);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.entry-view__tab:hover { color: var(--ss-text); }

.entry-view__tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

.entry-view__doc-body {
  padding: 1.5rem;
}

.entry-view__unsupported,
.entry-view__empty-doc {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--ss-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.entry-view__unsupported .pi {
  font-size: 1.5rem;
  color: var(--ss-text-subtle);
}

.entry-view__no-docs {
  color: var(--ss-text-muted);
  font-size: 0.875rem;
  font-style: italic;
  margin-bottom: 1.5rem;
}

/* ── Relations ── */
.entry-view__relations {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg);
  padding: 1rem 1.25rem;
}

.entry-view__relations-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-text-muted);
  margin: 0 0 0.75rem;
}

.entry-view__relations-heading .pi {
  color: var(--ss-primary);
}

.entry-view__relation-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.entry-view__relation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.entry-view__relation-dir {
  color: var(--ss-text-subtle);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.entry-view__relation-type {
  color: var(--ss-text-muted);
  font-style: italic;
  font-size: 0.8rem;
}

.entry-view__relation-link {
  background: none;
  border: none;
  color: var(--ss-primary);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.entry-view__relation-link:hover {
  color: var(--ss-primary-dark, var(--ss-primary));
  opacity: 0.85;
}

.entry-view__relation-unknown {
  color: var(--ss-text-muted);
  font-style: italic;
}

/* ── Empty / error ── */
.entry-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  text-align: center;
}

.entry-view__empty-icon {
  font-size: 2rem;
  color: var(--ss-text-subtle);
}

.entry-view__empty-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ss-text-muted);
}

.entry-view__empty--error .entry-view__empty-icon { color: var(--ss-danger); }

@media (max-width: 767px) {
  .entry-view { max-width: 100%; }
  .entry-view__title { font-size: 1.3rem; }
  .entry-view__doc-body { padding: 1rem; }
}
</style>
