<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputChips from 'primevue/inputchips'
import Textarea from 'primevue/textarea'
import Skeleton from 'primevue/skeleton'
import TiptapRenderer from './TiptapRenderer.vue'
import CodexEditor from './CodexEditor.vue'
import TimelineView from './TimelineView.vue'
import { codexService, type CodexEntryDetail, type EntryType } from '@/services/codexService'
import { uploadImage } from '@/services/uploadService'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()

const props = defineProps<{
  slug: string | null
}>()

defineEmits<{ navigate: [slug: string] }>()

const auth = useAuthStore()

const detail = ref<CodexEntryDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const activeDocIndex = ref(0)

// Edit mode state
const isEditing = ref(false)
const saving = ref(false)
const metaForm = reactive({
  name: '',
  type: 'lore' as EntryType,
  status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  permission: 'PLAYERS' as 'PUBLIC' | 'PLAYERS' | 'DM_ONLY' | 'PRIVATE',
  tags: [] as string[],
  summary: '',
})
const editorContent = ref<unknown>(null)

// Banner state
const bannerForm = reactive({ enabled: false, url: '', yPosition: 50 })
const bannerUploading = ref(false)
const bannerUploadProgress = ref(0)
const bannerUploadError = ref<string | null>(null)
const bannerFileInput = ref<HTMLInputElement | null>(null)

async function handleBannerFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  bannerUploading.value = true
  bannerUploadError.value = null
  bannerUploadProgress.value = 0
  const result = await uploadImage(file, (percent) => {
    bannerUploadProgress.value = percent
  })
  bannerUploading.value = false
  if (result.type === 'ok') {
    bannerForm.url = result.data
    bannerForm.enabled = true
  } else {
    bannerUploadError.value = result.message
  }
  if (bannerFileInput.value) bannerFileInput.value.value = ''
}

async function load(slug: string) {
  loading.value = true
  error.value = null
  detail.value = null
  activeDocIndex.value = 0
  isEditing.value = false

  const result = await codexService.getBySlug(slug)
  loading.value = false

  if (result.type === 'ok') {
    detail.value = result.data
    const visible = result.data.documents.filter((d) => !d.isHidden)
    const firstFlagIdx = visible.findIndex((d) => d.isFirst)
    const firstPageIdx = visible.findIndex((d) => d.type === 'page')
    activeDocIndex.value = firstFlagIdx >= 0 ? firstFlagIdx : firstPageIdx >= 0 ? firstPageIdx : 0
  } else {
    error.value = result.message
  }
}

watch(
  () => props.slug,
  (s) => {
    if (s) load(s)
    else {
      detail.value = null
      isEditing.value = false
    }
  },
  { immediate: true },
)

const entry = computed(() => detail.value?.entry)
const visibleDocs = computed(() => (detail.value?.documents ?? []).filter((d) => !d.isHidden))
const relations = computed(() => detail.value?.relations ?? [])
const activeDoc = computed(() => visibleDocs.value[activeDocIndex.value] ?? null)

// Permission logic (uses effectiveUser so dev role toggles affect the UI)
const canWrite = computed(() => {
  const user = auth.effectiveUser
  const e = entry.value
  if (!user || !e) return false
  if (user.role === 'DM' || user.role === 'ADMIN') return true
  if (e.isLocked) return false
  if (!user.isWorldbuilder) return false
  return e.authorId === user.id || (e.editors ?? []).includes(user.id)
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

const STATUS_OPTIONS = computed(() => [
  { label: t('codex.status.draft'), value: 'DRAFT' },
  { label: t('codex.status.published'), value: 'PUBLISHED' },
  { label: t('codex.status.archived'), value: 'ARCHIVED' },
])

const permissionOptions = computed(() => {
  const opts: { label: string; value: string }[] = [
    { label: t('codex.permission.public'), value: 'PUBLIC' },
    { label: t('codex.permission.players'), value: 'PLAYERS' },
    { label: t('codex.permission.private'), value: 'PRIVATE' },
  ]
  const r = auth.effectiveUser?.role
  if (r === 'DM' || r === 'ADMIN') {
    opts.splice(2, 0, { label: t('codex.permission.dmOnly'), value: 'DM_ONLY' })
  }
  return opts
})

function enterEditMode() {
  if (!entry.value) return
  metaForm.name = entry.value.name
  metaForm.type = entry.value.type
  metaForm.status = entry.value.status
  metaForm.permission = entry.value.permission
  metaForm.tags = [...(entry.value.tags ?? [])]
  metaForm.summary = entry.value.summary ?? ''
  editorContent.value = activeDoc.value?.content ?? null
  bannerForm.enabled = entry.value.banner?.enabled ?? false
  bannerForm.url = entry.value.banner?.url ?? ''
  bannerForm.yPosition = entry.value.banner?.yPosition ?? 50
  bannerUploadError.value = null
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function saveEdit() {
  if (!entry.value) return
  saving.value = true
  try {
    await codexService.updateEntry(entry.value.id, {
      name: metaForm.name,
      type: metaForm.type,
      status: metaForm.status,
      permission: metaForm.permission,
      tags: metaForm.tags,
      summary: metaForm.summary,
      banner: { enabled: bannerForm.enabled, url: bannerForm.url, yPosition: bannerForm.yPosition },
    })
    if (activeDoc.value && editorContent.value) {
      await codexService.updateDocument(entry.value.id, activeDoc.value.id, {
        content: editorContent.value as never,
      })
    }
    isEditing.value = false
    if (props.slug) await load(props.slug)
  } finally {
    saving.value = false
  }
}

function hasContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false
  const doc = content as { type?: string; content?: unknown[] }
  return doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timelineContent(content: unknown): any {
  return content ?? {}
}

const TYPE_META: Record<EntryType, { label: string; icon: string }> = {
  lore: { label: t('codex.types.lore'), icon: 'pi-book' },
  location: { label: t('codex.types.location'), icon: 'pi-map-marker' },
  npc: { label: t('codex.types.npc'), icon: 'pi-user' },
  faction: { label: t('codex.types.faction'), icon: 'pi-users' },
  item: { label: t('codex.types.item'), icon: 'pi-star' },
  event: { label: t('codex.types.event'), icon: 'pi-calendar' },
  rule: { label: t('codex.types.rule'), icon: 'pi-file' },
  session: { label: t('codex.types.session'), icon: 'pi-play' },
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="!slug" class="detail-empty">
    <i class="pi pi-book detail-empty__icon" aria-hidden="true" />
    <p class="detail-empty__text">{{ $t('codex.selectEntry') }}</p>
  </div>

  <!-- Loading -->
  <template v-else-if="loading">
    <div class="detail-content">
      <Skeleton height="2rem" width="55%" class="detail-skel" />
      <Skeleton height="0.9rem" width="25%" class="detail-skel" />
      <div style="height: 1rem" />
      <Skeleton v-for="n in 5" :key="n" height="0.875rem" class="detail-skel" />
    </div>
  </template>

  <!-- Error -->
  <div v-else-if="error" class="detail-empty detail-empty--error">
    <i class="pi pi-exclamation-circle detail-empty__icon" />
    <p class="detail-empty__text">{{ error }}</p>
  </div>

  <!-- Content -->
  <template v-else-if="entry">
    <!-- Banner -->
    <div
      v-if="entry.banner.enabled && entry.banner.url"
      class="detail-banner"
      :style="{
        backgroundImage: `url(${entry.banner.url})`,
        backgroundPositionY: `${entry.banner.yPosition}%`,
      }"
    />

    <div class="detail-content">
      <!-- ── Edit mode: metadata form ── -->
      <template v-if="isEditing">
        <div class="edit-meta">
          <div class="edit-meta__row">
            <label class="edit-label">{{ $t('codex.editForm.titleLabel') }}</label>
            <InputText v-model="metaForm.name" class="edit-title-input" />
          </div>
          <div class="edit-meta__row edit-meta__row--cols">
            <div class="edit-field">
              <label class="edit-label">{{ $t('codex.editForm.typeLabel') }}</label>
              <Select
                v-model="metaForm.type"
                :options="TYPE_OPTIONS"
                option-label="label"
                option-value="value"
                class="edit-select"
              />
            </div>
            <div class="edit-field">
              <label class="edit-label">{{ $t('codex.editForm.statusLabel') }}</label>
              <Select
                v-model="metaForm.status"
                :options="STATUS_OPTIONS"
                option-label="label"
                option-value="value"
                class="edit-select"
              />
            </div>
            <div class="edit-field">
              <label class="edit-label">{{ $t('codex.editForm.permissionLabel') }}</label>
              <Select
                v-model="metaForm.permission"
                :options="permissionOptions"
                option-label="label"
                option-value="value"
                class="edit-select"
              />
            </div>
          </div>
          <div class="edit-meta__row">
            <label class="edit-label">{{ $t('codex.editForm.summaryLabel') }}</label>
            <Textarea
              v-model="metaForm.summary"
              :rows="2"
              auto-resize
              class="edit-textarea"
              :placeholder="$t('codex.editForm.summaryPlaceholder')"
            />
          </div>
          <div class="edit-meta__row">
            <label class="edit-label">{{ $t('codex.editForm.tagsLabel') }}</label>
            <InputChips
              v-model="metaForm.tags"
              :placeholder="$t('codex.editForm.tagsPlaceholder')"
              class="edit-chips"
            />
          </div>

          <!-- Banner -->
          <div class="edit-meta__row">
            <label class="edit-label">{{ $t('codex.editForm.bannerLabel') }}</label>

            <!-- Preview -->
            <div
              v-if="bannerForm.url"
              class="edit-banner-preview"
              :style="{
                backgroundImage: `url(${bannerForm.url})`,
                backgroundPositionY: `${bannerForm.yPosition}%`,
              }"
            />

            <div class="edit-banner-controls">
              <input
                ref="bannerFileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="edit-banner-file-input"
                @change="handleBannerFile"
              />
              <Button
                :label="
                  bannerForm.url
                    ? $t('codex.editForm.bannerReplace')
                    : $t('codex.editForm.bannerUpload')
                "
                icon="pi pi-upload"
                size="small"
                outlined
                :loading="bannerUploading"
                @click="bannerFileInput?.click()"
              />

              <template v-if="bannerForm.url">
                <label class="edit-label edit-label--inline">
                  {{ $t('codex.editForm.bannerVisible') }}
                  <input v-model="bannerForm.enabled" type="checkbox" />
                </label>

                <div class="edit-banner-position">
                  <span class="edit-label edit-label--inline">{{
                    $t('codex.editForm.bannerVerticalPosition')
                  }}</span>
                  <input
                    v-model.number="bannerForm.yPosition"
                    type="range"
                    min="0"
                    max="100"
                    class="edit-banner-slider"
                  />
                  <span class="edit-banner-position-val">{{ bannerForm.yPosition }}%</span>
                </div>

                <button
                  class="edit-banner-remove"
                  @click="
                    bannerForm.url = '';
                    bannerForm.enabled = false;
                  "
                >
                  <i class="pi pi-times" /> {{ $t('codex.editForm.bannerRemove') }}
                </button>
              </template>

              <!-- Upload progress -->
              <div v-if="bannerUploading" class="edit-banner-progress">
                <div
                  class="edit-banner-progress-bar"
                  :style="{ width: `${bannerUploadProgress}%` }"
                />
              </div>
              <p v-if="bannerUploadError" class="edit-banner-error">{{ bannerUploadError }}</p>
            </div>
          </div>

          <div class="edit-actions">
            <Button
              :label="$t('common.save')"
              icon="pi pi-check"
              :loading="saving"
              @click="saveEdit"
            />
            <Button :label="$t('common.cancel')" text severity="secondary" @click="cancelEdit" />
          </div>
        </div>
      </template>

      <!-- ── View mode: title row ── -->
      <template v-else>
        <div class="detail-title-row">
          <h1 class="detail-title">{{ entry.name }}</h1>
          <div class="detail-badges">
            <Tag severity="secondary" class="detail-type-tag">
              <template #default>
                <i :class="['pi', TYPE_META[entry.type]?.icon ?? 'pi-circle']" aria-hidden="true" />
                {{ TYPE_META[entry.type]?.label ?? entry.type }}
              </template>
            </Tag>
            <Tag
              v-if="entry.permission === 'DM_ONLY'"
              :value="$t('codex.permission.dmOnly')"
              severity="warn"
            />
            <Tag
              v-if="entry.status === 'DRAFT'"
              :value="$t('codex.status.draft')"
              severity="warn"
            />
            <Tag v-if="entry.isLocked" severity="secondary">
              <template #default><i class="pi pi-lock" /></template>
            </Tag>
            <Button
              v-if="canWrite"
              icon="pi pi-pencil"
              :label="$t('common.edit')"
              size="small"
              text
              class="detail-edit-btn"
              @click="enterEditMode"
            />
          </div>
        </div>

        <p v-if="entry.summary" class="detail-summary">{{ entry.summary }}</p>

        <div v-if="entry.tags.length" class="detail-tags">
          <span v-for="tag in entry.tags" :key="tag" class="detail-tag">{{ tag }}</span>
        </div>

        <p v-if="entry.aliases.length" class="detail-aliases">
          <span class="detail-aliases__label">{{ $t('codex.alsoKnownAs') }}</span>
          {{ entry.aliases.join(', ') }}
        </p>
      </template>

      <!-- ── Documents ── -->
      <div v-if="visibleDocs.length" class="detail-docs">
        <div v-if="visibleDocs.length > 1" class="detail-tabs">
          <button
            v-for="(doc, i) in visibleDocs"
            :key="doc.id"
            class="detail-tab"
            :class="{ 'detail-tab--active': activeDocIndex === i }"
            :disabled="isEditing"
            @click="activeDocIndex = i"
          >
            {{ doc.name }}
          </button>
        </div>

        <div
          v-if="activeDoc"
          class="detail-doc-body"
          :class="{ 'detail-doc-body--timeline': activeDoc.type === 'time' }"
        >
          <!-- Edit mode: show editor for page docs -->
          <CodexEditor
            v-if="isEditing && activeDoc.type === 'page'"
            :key="activeDoc.id"
            :doc-id="activeDoc.id"
            :content="editorContent"
            @update="editorContent = $event"
          />

          <!-- View mode -->
          <template v-else-if="!isEditing">
            <TiptapRenderer
              v-if="activeDoc.type === 'page' && hasContent(activeDoc.content)"
              :content="activeDoc.content"
              @navigate="$emit('navigate', $event)"
            />
            <div v-else-if="activeDoc.type === 'page'" class="detail-no-content">
              {{ $t('codex.docViewer.noContent') }}
            </div>
            <TimelineView
              v-else-if="activeDoc.type === 'time'"
              :content="timelineContent(activeDoc.content)"
              :calendar-id="activeDoc.calendarId ?? null"
              @navigate="$emit('navigate', $event)"
            />
            <div v-else class="detail-no-content">
              <i class="pi pi-clock" />
              {{
                $t('codex.docViewer.notYetSupported', {
                  type: activeDoc.type.charAt(0).toUpperCase() + activeDoc.type.slice(1),
                })
              }}
            </div>
          </template>
        </div>
      </div>

      <div v-else class="detail-no-content detail-no-content--standalone">
        {{ $t('codex.noDocumentsShort') }}
      </div>

      <!-- ── Relations ── -->
      <div v-if="relations.length && !isEditing" class="detail-relations">
        <h2 class="detail-relations__heading">
          <i class="pi pi-link" aria-hidden="true" />
          {{ $t('codex.related') }}
        </h2>
        <div class="detail-relations__list">
          <div v-for="rel in relations" :key="rel.id" class="detail-relation">
            <i
              :class="['pi', rel.direction === 'outgoing' ? 'pi-arrow-right' : 'pi-arrow-left']"
              class="detail-relation__dir"
            />
            <span v-if="rel.type" class="detail-relation__type">{{ rel.type }}</span>
            <button
              v-if="rel.relatedEntry"
              class="detail-relation__link"
              @click="$emit('navigate', rel.relatedEntry!.slug)"
            >
              {{ rel.relatedEntry.name }}
            </button>
            <span v-else class="detail-relation__unknown">{{ $t('codex.unknownEntry') }}</span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* ── Empty state ── */
.detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--ss-text-muted);
}

.detail-empty__icon {
  font-size: 2.5rem;
  color: var(--ss-text-subtle);
  opacity: 0.4;
}
.detail-empty__text {
  margin: 0;
  font-size: 0.9rem;
}
.detail-empty--error .detail-empty__icon {
  color: var(--ss-danger);
  opacity: 1;
}

/* ── Skeleton ── */
.detail-skel {
  margin-bottom: 0.5rem;
}

/* ── Banner ── */
.detail-banner {
  width: 100%;
  height: 140px;
  background-size: cover;
  background-repeat: no-repeat;
  flex-shrink: 0;
}

/* ── Content ── */
.detail-content {
  padding: 1.25rem 1.5rem 2rem;
}

.detail-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.detail-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  flex: 1;
  min-width: 0;
}

.detail-badges {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.detail-type-tag :deep(.p-tag-value) {
  display: flex;
  align-items: center;
  gap: 0.3em;
  font-size: 0.75rem;
}

.detail-edit-btn {
  font-size: 0.75rem !important;
  padding: 0.2rem 0.5rem !important;
}

.detail-summary {
  margin: 0 0 0.75rem;
  color: var(--ss-text-muted);
  font-size: 0.875rem;
  line-height: 1.6;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
}

.detail-tag {
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
  color: var(--ss-primary);
  border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
  border-radius: 99px;
  padding: 0.1em 0.55em;
  font-size: 0.7rem;
  font-weight: 500;
}

.detail-aliases {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
}
.detail-aliases__label {
  font-weight: 600;
  margin-right: 0.25em;
}

/* ── Edit meta form ── */
.edit-meta {
  margin-bottom: 1.25rem;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-meta__row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.edit-meta__row--cols {
  flex-direction: row;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 140px;
}

.edit-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

.edit-title-input {
  width: 100%;
  font-size: 1.1rem !important;
  font-weight: 600 !important;
}
.edit-select {
  width: 100%;
}
.edit-textarea {
  width: 100%;
  font-size: 0.875rem;
}
.edit-chips {
  width: 100%;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

/* ── Docs ── */
.detail-docs {
  margin-top: 1rem;
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--ss-border);
  background: var(--ss-parchment-dark);
  overflow-x: auto;
}

.detail-tab {
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ss-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.1s,
    border-color 0.1s;
}

.detail-tab:hover {
  color: var(--ss-text);
}
.detail-tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}
.detail-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.detail-doc-body {
  padding: 1.25rem;
  background: var(--ss-surface);
}
.detail-doc-body--timeline {
  padding: 0;
}

.detail-no-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--ss-text-muted);
  font-size: 0.825rem;
  font-style: italic;
}

.detail-no-content--standalone {
  margin-top: 1rem;
}

/* ── Relations ── */
.detail-relations {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ss-border);
}

.detail-relations__heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-text-muted);
  margin: 0 0 0.6rem;
}

.detail-relations__heading .pi {
  color: var(--ss-primary);
}
.detail-relations__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.detail-relation {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}
.detail-relation__dir {
  color: var(--ss-text-subtle);
  font-size: 0.7rem;
}
.detail-relation__type {
  color: var(--ss-text-muted);
  font-style: italic;
  font-size: 0.75rem;
}

.detail-relation__link {
  background: none;
  border: none;
  color: var(--ss-primary);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.detail-relation__unknown {
  color: var(--ss-text-muted);
  font-style: italic;
}

/* ── Banner upload ── */
.edit-banner-preview {
  width: 100%;
  height: 100px;
  background-size: cover;
  background-repeat: no-repeat;
  border-radius: var(--ss-radius);
  border: 1px solid var(--ss-border);
  margin-bottom: 0.5rem;
}

.edit-banner-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.edit-banner-file-input {
  display: none;
}

.edit-label--inline {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ss-text-muted);
}

.edit-banner-position {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.edit-banner-slider {
  flex: 1;
  accent-color: var(--ss-primary);
}

.edit-banner-position-val {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  min-width: 2.5rem;
  text-align: right;
}

.edit-banner-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--ss-danger, #ef4444);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
}
.edit-banner-remove:hover {
  opacity: 0.75;
}

.edit-banner-progress {
  width: 100%;
  height: 4px;
  background: var(--ss-border);
  border-radius: 99px;
  overflow: hidden;
}

.edit-banner-progress-bar {
  height: 100%;
  background: var(--ss-primary);
  transition: width 0.2s;
}

.edit-banner-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ss-danger, #ef4444);
}
</style>
