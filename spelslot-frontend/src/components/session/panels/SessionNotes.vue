<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { codexService } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  sessionId: string | null
  sessionDocId: string | null
  readonly: boolean
}>()

const auth = useAuthStore()
const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:3001'

const saving = ref(false)
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const collabStatus = ref<'connected' | 'connecting' | 'disconnected'>('disconnected')

// ── Y.js + Hocuspocus ────────────────────────────────────────────────────
// Provider is created once at mount (when sessionDocId is set).
// The parent uses :key="sessionDocId" on this component so Vue remounts
// it (and thus rebuilds the provider) whenever the session changes.

const ydoc = new Y.Doc()

let provider: HocuspocusProvider | null = null

if (props.sessionDocId) {
  provider = new HocuspocusProvider({
    url: COLLAB_URL,
    name: props.sessionDocId,
    document: ydoc,
    token: () => auth.firebaseUser?.getIdToken() ?? Promise.resolve(''),
    onStatus({ status }) {
      collabStatus.value = status as typeof collabStatus.value
    },
    async onSynced() {
      // Seed from REST content if no Y.js state exists yet for this doc
      const fragment = ydoc.getXmlFragment('default')
      if (fragment.length === 0 && props.sessionId && props.sessionDocId) {
        const result = await codexService.getDocuments(props.sessionId)
        if (result.type === 'ok') {
          const doc = result.data.find((d) => d.id === props.sessionDocId)
          if (doc?.content) {
            editor.value?.commands.setContent(doc.content as object)
          }
        }
      }
    },
  })
}

// ── Editor ───────────────────────────────────────────────────────────────

const editor = useEditor({
  editable: !props.readonly,
  extensions: [
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: ydoc }),
  ],
  onUpdate({ editor: e }) {
    if (props.readonly) return
    scheduleAutoSave(e.getJSON())
  },
})

watch(
  () => props.readonly,
  (val) => editor.value?.setEditable(!val),
)

function scheduleAutoSave(content: object) {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  saveTimer.value = setTimeout(() => persistNotes(content), 1500)
}

async function persistNotes(content: object) {
  if (!props.sessionId || !props.sessionDocId) return
  saving.value = true
  await codexService.updateDocument(props.sessionId, props.sessionDocId, { content })
  saving.value = false
}

onBeforeUnmount(() => {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  provider?.destroy()
  editor.value?.destroy()
})
</script>

<template>
  <div class="session-notes">
    <div v-if="!sessionId" class="session-notes__empty">
      <i class="pi pi-file-edit session-notes__empty-icon" />
      <p>Select a session to view shared notes.</p>
    </div>

    <template v-else>
      <div class="session-notes__bar">
        <span class="session-notes__label">
          <i class="pi pi-users" /> Shared notes
        </span>
        <span class="session-notes__collab-dot" :class="`session-notes__collab-dot--${collabStatus}`" :title="`Collaboration: ${collabStatus}`" />
        <span v-if="saving" class="session-notes__saving">
          <i class="pi pi-spin pi-spinner" /> Saving…
        </span>
        <span v-else-if="readonly" class="session-notes__readonly-tag">Read-only</span>
      </div>

      <EditorContent :editor="editor" class="session-notes__editor" />
    </template>
  </div>
</template>

<style scoped>
.session-notes {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.session-notes__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  color: var(--ss-text-muted);
  text-align: center;
  padding: 1rem;
}

.session-notes__empty-icon { font-size: 2rem; opacity: 0.3; }
.session-notes__empty p { margin: 0; font-size: 0.82rem; }

.session-notes__bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--ss-border);
  font-size: 0.72rem;
  flex-shrink: 0;
}

.session-notes__label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ss-text-muted);
  font-weight: 600;
}

.session-notes__label .pi { color: var(--ss-primary); font-size: 0.7rem; }

/* Collaboration status dot */
.session-notes__collab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--ss-border);
}
.session-notes__collab-dot--connected { background: #22c55e; }
.session-notes__collab-dot--connecting { background: #f59e0b; animation: sn-pulse 1s ease-in-out infinite; }
.session-notes__collab-dot--disconnected { background: #ef4444; }

@keyframes sn-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.session-notes__saving {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ss-text-muted);
  font-size: 0.68rem;
  margin-left: auto;
}

.session-notes__readonly-tag {
  margin-left: auto;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  background: color-mix(in srgb, var(--ss-border) 60%, transparent);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.session-notes__editor {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.9rem;
}

.session-notes__editor :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  color: var(--ss-text);
  line-height: 1.7;
  font-size: 0.88rem;
}

.session-notes__editor :deep(.ProseMirror p) { margin: 0 0 0.5em; }
.session-notes__editor :deep(.ProseMirror h1) { font-size: 1.25rem; margin: 1em 0 0.4em; font-weight: 700; }
.session-notes__editor :deep(.ProseMirror h2) { font-size: 1.05rem; margin: 0.9em 0 0.35em; font-weight: 700; }
.session-notes__editor :deep(.ProseMirror h3) { font-size: 0.9rem; margin: 0.8em 0 0.3em; font-weight: 700; }

.session-notes__editor :deep(.ProseMirror ul),
.session-notes__editor :deep(.ProseMirror ol) {
  padding-left: 1.4em;
  margin: 0 0 0.5em;
}

.session-notes__editor :deep(.ProseMirror li) { margin-bottom: 0.15em; }
.session-notes__editor :deep(.ProseMirror strong) { font-weight: 700; }

.session-notes__editor :deep(.ProseMirror.is-editor-empty:first-child::before) {
  content: 'Shared session notes appear here…';
  float: left;
  color: var(--ss-text-muted);
  opacity: 0.5;
  pointer-events: none;
  font-size: 0.85rem;
}
</style>
