<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { notesService, type NoteMeta } from '@/services/notesService'

const { t } = useI18n()

const props = defineProps<{
  sessionId: string | null
}>()

// ── State ─────────────────────────────────────────────────────────────────

const notes = ref<NoteMeta[]>([])
const activeId = ref<string | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const loading = ref(false)

// ── Editor ────────────────────────────────────────────────────────────────

const editor = useEditor({
  editable: true,
  extensions: [StarterKit],
  onUpdate({ editor: e }) {
    if (activeId.value) scheduleAutoSave(e.getJSON())
  },
})

// ── Load / switch session ─────────────────────────────────────────────────

async function openSession(sessionId: string | null) {
  if (!sessionId) {
    notes.value = []
    activeId.value = null
    editor.value?.commands.clearContent()
    return
  }
  loading.value = true
  const listResult = await notesService.list(sessionId, 'player')
  if (listResult.type === 'error') {
    loading.value = false
    return
  }

  if (listResult.data.length === 0) {
    // Auto-create the first note
    const created = await notesService.create(sessionId, 'player')
    if (created.type === 'ok') {
      notes.value = [created.data]
      await activateNote(sessionId, created.data._id)
    }
  } else {
    notes.value = listResult.data
    await activateNote(sessionId, listResult.data[0]._id)
  }
  loading.value = false
}

async function activateNote(sessionId: string, noteId: string) {
  activeId.value = noteId
  const r = await notesService.load(sessionId, 'player', noteId)
  if (r.type === 'ok') {
    const content =
      r.data.content && Object.keys(r.data.content).length > 0
        ? r.data.content
        : { type: 'doc', content: [] }
    editor.value?.commands.setContent(content as object)
  }
}

async function switchNote(noteId: string) {
  if (!props.sessionId || noteId === activeId.value) return
  // Flush any pending save before switching
  if (saveTimer.value) {
    clearTimeout(saveTimer.value)
    saveTimer.value = null
    if (activeId.value) {
      await notesService.save(props.sessionId, 'player', activeId.value, editor.value!.getJSON())
    }
  }
  await activateNote(props.sessionId, noteId)
}

async function addNote() {
  if (!props.sessionId) return
  const r = await notesService.create(props.sessionId, 'player')
  if (r.type === 'ok') {
    notes.value = [...notes.value, r.data]
    await activateNote(props.sessionId, r.data._id)
  }
}

watch(
  () => props.sessionId,
  (id) => {
    openSession(id)
  },
  { immediate: true },
)

// ── Auto-save ─────────────────────────────────────────────────────────────

function scheduleAutoSave(content: object) {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  saveStatus.value = 'idle'
  saveTimer.value = setTimeout(async () => {
    if (!props.sessionId || !activeId.value) return
    saveStatus.value = 'saving'
    const r = await notesService.save(props.sessionId, 'player', activeId.value, content)
    saveStatus.value = r.type === 'ok' ? 'saved' : 'error'
    if (saveStatus.value === 'saved')
      setTimeout(() => {
        saveStatus.value = 'idle'
      }, 2000)
  }, 800)
}

const editorStyle = computed(() => ({
  '--my-notes-placeholder': `"${t('session.notes.myNotesPlaceholder')}"`,
}))

onBeforeUnmount(() => {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  editor.value?.destroy()
})
</script>

<template>
  <div class="my-notes">
    <!-- Tab bar -->
    <div class="my-notes__tabs">
      <div class="my-notes__tab-list">
        <button
          v-for="note in notes"
          :key="note._id"
          class="my-notes__tab"
          :class="{ 'my-notes__tab--active': note._id === activeId }"
          @click="switchNote(note._id)"
        >
          {{ note.name }}
        </button>
      </div>
      <button class="my-notes__add" :title="$t('session.notes.newNote')" @click="addNote">
        <i class="pi pi-plus" />
      </button>
    </div>

    <!-- Status bar -->
    <div class="my-notes__bar">
      <span class="my-notes__label">
        <i class="pi pi-pencil" /> {{ $t('session.notes.myNotesLabel') }}
      </span>
      <span class="my-notes__autosave" :class="`my-notes__autosave--${saveStatus}`">
        <template v-if="saveStatus === 'saving'">{{
          $t('session.notes.savingStatus.saving')
        }}</template>
        <template v-else-if="saveStatus === 'saved'">{{
          $t('session.notes.savingStatus.saved')
        }}</template>
        <template v-else-if="saveStatus === 'error'">{{
          $t('session.notes.savingStatus.error')
        }}</template>
        <template v-else>{{ $t('session.notes.savingStatus.idle') }}</template>
      </span>
    </div>

    <!-- Editor -->
    <div v-if="loading" class="my-notes__loading">{{ $t('common.loading') }}</div>
    <EditorContent v-else :editor="editor" class="my-notes__editor" :style="editorStyle" />
  </div>
</template>

<style scoped>
.my-notes {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab bar */
.my-notes__tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ss-border);
  background: var(--ss-parchment-dark, var(--ss-surface));
  flex-shrink: 0;
  min-height: 32px;
}

.my-notes__tab-list {
  display: flex;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.my-notes__tab-list::-webkit-scrollbar {
  display: none;
}

.my-notes__tab {
  padding: 0.3rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ss-text-muted);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition:
    color 0.15s,
    border-color 0.15s;
  flex-shrink: 0;
}
.my-notes__tab:hover {
  color: var(--ss-text);
}
.my-notes__tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

.my-notes__add {
  padding: 0.3rem 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--ss-text-muted);
  font-size: 0.65rem;
  flex-shrink: 0;
  transition: color 0.15s;
}
.my-notes__add:hover {
  color: var(--ss-primary);
}

/* Status bar */
.my-notes__bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  font-size: 0.68rem;
  flex-shrink: 0;
}

.my-notes__label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ss-text-muted);
  font-weight: 600;
}
.my-notes__label .pi {
  color: var(--ss-primary);
  font-size: 0.65rem;
}

.my-notes__autosave {
  margin-left: auto;
  font-size: 0.62rem;
  color: var(--ss-text-muted);
  opacity: 0.6;
  transition:
    color 0.2s,
    opacity 0.2s;
}
.my-notes__autosave--saving {
  opacity: 0.8;
}
.my-notes__autosave--saved {
  color: var(--ss-success, #22c55e);
  opacity: 1;
}
.my-notes__autosave--error {
  color: var(--ss-danger, #ef4444);
  opacity: 1;
}

/* Editor */
.my-notes__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.my-notes__editor {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.9rem;
}

.my-notes__editor :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  color: var(--ss-text);
  line-height: 1.7;
  font-size: 0.88rem;
}
.my-notes__editor :deep(.ProseMirror p) {
  margin: 0 0 0.5em;
}
.my-notes__editor :deep(.ProseMirror ul),
.my-notes__editor :deep(.ProseMirror ol) {
  padding-left: 1.4em;
  margin: 0 0 0.5em;
}
.my-notes__editor :deep(.ProseMirror li) {
  margin-bottom: 0.15em;
}
.my-notes__editor :deep(.ProseMirror.is-editor-empty:first-child::before) {
  content: var(--my-notes-placeholder);
  float: left;
  color: var(--ss-text-muted);
  opacity: 0.5;
  pointer-events: none;
  font-size: 0.85rem;
}
</style>
