<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Mention from '@tiptap/extension-mention'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import tippy, { type Instance } from 'tippy.js'
import MentionList from './MentionList.vue'
import { codexService } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  docId: string
  content: unknown
}>()

const emit = defineEmits<{
  update: [content: object]
}>()

const auth = useAuthStore()
const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:3001'

// ── Y.js + Hocuspocus ────────────────────────────────────────────────────

const ydoc = new Y.Doc()
const collabStatus = ref<'connected' | 'connecting' | 'disconnected'>('disconnected')

const provider = shallowRef(
  new HocuspocusProvider({
    url: COLLAB_URL,
    name: props.docId,
    document: ydoc,
    // Token as function so it's fetched fresh at connection time (handles expiry)
    token: () => auth.firebaseUser?.getIdToken() ?? Promise.resolve(''),
    onStatus({ status }) {
      collabStatus.value = status as typeof collabStatus.value
    },
    onSynced() {
      // If the server had no prior Y.js state for this doc, seed from the
      // ProseMirror JSON that was loaded via the REST API.
      const fragment = ydoc.getXmlFragment('default')
      if (fragment.length === 0 && props.content) {
        editor.value?.commands.setContent(props.content as object)
      }
    },
  }),
)

// ── Mention suggestion ───────────────────────────────────────────────────

const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    if (!query) return []
    const result = await codexService.listEntries(query)
    return result.type === 'ok' ? result.data.slice(0, 8) : []
  },
  render: () => {
    let renderer: VueRenderer
    let popup: Instance[]

    return {
      onStart: (suggProps: Record<string, unknown>) => {
        renderer = new VueRenderer(MentionList, {
          props: suggProps,
          editor: suggProps.editor as never,
        })
        if (!suggProps.clientRect) return
        popup = tippy('body', {
          getReferenceClientRect: suggProps.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: renderer.element ?? document.createElement('div'),
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        }) as unknown as Instance[]
      },
      onUpdate: (suggProps: Record<string, unknown>) => {
        renderer?.updateProps(suggProps)
        if (!suggProps.clientRect || !popup?.[0]) return
        popup[0].setProps({ getReferenceClientRect: suggProps.clientRect as () => DOMRect })
      },
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'Escape') { popup?.[0]?.hide(); return true }
        return (renderer?.ref as { onKeyDown?: (e: KeyboardEvent) => boolean } | null)?.onKeyDown?.(event) ?? false
      },
      onExit: () => {
        popup?.[0]?.destroy()
        renderer?.destroy()
      },
    }
  },
}

// ── Editor ───────────────────────────────────────────────────────────────

const editor = useEditor({
  extensions: [
    // Disable StarterKit's built-in undo/redo — Collaboration provides Y.js UndoManager instead
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: ydoc }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Mention.configure({
      HTMLAttributes: { class: 'codex-mention' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suggestion: mentionSuggestion as any,
    }),
  ],
  onUpdate: ({ editor: e }) => {
    // Still emit so CodexDetailPanel can save metadata + content together on "Save"
    emit('update', e.getJSON())
  },
})

onBeforeUnmount(() => {
  provider.value.destroy()
  editor.value?.destroy()
})

function cmd() { return editor.value?.chain().focus() }
function isActive(name: string, attrs?: object) { return editor.value?.isActive(name, attrs) ?? false }
function insertTable() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(editor.value?.chain().focus() as any)?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
</script>

<template>
  <div class="codex-editor">
    <div v-if="editor" class="codex-editor__toolbar">
      <!-- Text marks -->
      <button class="ce-btn" :class="{ active: isActive('bold') }" title="Bold" @click="cmd()?.toggleBold().run()"><b>B</b></button>
      <button class="ce-btn" :class="{ active: isActive('italic') }" title="Italic" @click="cmd()?.toggleItalic().run()"><em>I</em></button>
      <button class="ce-btn" :class="{ active: isActive('strike') }" title="Strikethrough" @click="cmd()?.toggleStrike().run()"><s>S</s></button>
      <button class="ce-btn" :class="{ active: isActive('code') }" title="Inline code" @click="cmd()?.toggleCode().run()">
        <i class="pi pi-code" style="font-size:0.75rem" />
      </button>

      <span class="ce-sep" />

      <!-- Headings -->
      <button class="ce-btn" :class="{ active: isActive('heading', { level: 1 }) }" title="Heading 1" @click="cmd()?.toggleHeading({ level: 1 }).run()">H1</button>
      <button class="ce-btn" :class="{ active: isActive('heading', { level: 2 }) }" title="Heading 2" @click="cmd()?.toggleHeading({ level: 2 }).run()">H2</button>
      <button class="ce-btn" :class="{ active: isActive('heading', { level: 3 }) }" title="Heading 3" @click="cmd()?.toggleHeading({ level: 3 }).run()">H3</button>

      <span class="ce-sep" />

      <!-- Lists & blocks -->
      <button class="ce-btn" :class="{ active: isActive('bulletList') }" title="Bullet list" @click="cmd()?.toggleBulletList().run()">
        <i class="pi pi-list" style="font-size:0.75rem" />
      </button>
      <button class="ce-btn" :class="{ active: isActive('orderedList') }" title="Numbered list" @click="cmd()?.toggleOrderedList().run()">1.</button>
      <button class="ce-btn" :class="{ active: isActive('blockquote') }" title="Blockquote" @click="cmd()?.toggleBlockquote().run()">"</button>
      <button class="ce-btn" :class="{ active: isActive('codeBlock') }" title="Code block" @click="cmd()?.toggleCodeBlock().run()">{ }</button>

      <span class="ce-sep" />

      <!-- Table -->
      <button class="ce-btn" title="Insert table" @click="insertTable()">
        <i class="pi pi-table" style="font-size:0.75rem" />
      </button>

      <span class="ce-sep" />

      <!-- Undo / Redo — powered by Y.js UndoManager via Collaboration extension -->
      <button class="ce-btn" title="Undo" :disabled="!editor?.can().undo()" @click="cmd()?.undo().run()">
        <i class="pi pi-undo" style="font-size:0.75rem" />
      </button>
      <button class="ce-btn" title="Redo" :disabled="!editor?.can().redo()" @click="cmd()?.redo().run()">
        <i class="pi pi-replay" style="font-size:0.75rem" />
      </button>

      <!-- Connection indicator -->
      <span class="ce-sep" />
      <span class="ce-collab-dot" :class="`ce-collab-dot--${collabStatus}`" :title="`Collaboration: ${collabStatus}`" />
    </div>

    <EditorContent class="codex-editor__content" :editor="editor" />
  </div>
</template>

<style scoped>
.codex-editor {
  border: 1px solid var(--ss-primary);
  border-radius: var(--ss-radius, 6px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.codex-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--ss-border);
  background: var(--ss-parchment-dark);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.ce-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-family: inherit;
  color: var(--ss-text-muted);
  transition: background 0.1s, color 0.1s;
}

.ce-btn:hover { background: var(--ss-parchment-deeper, #e8ddd4); color: var(--ss-text); }
.ce-btn.active {
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  color: var(--ss-primary);
}
.ce-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.ce-sep {
  width: 1px;
  height: 18px;
  background: var(--ss-border);
  margin: 0 2px;
  flex-shrink: 0;
}

/* Collaboration status dot */
.ce-collab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--ss-border);
}
.ce-collab-dot--connected { background: var(--ss-success); }
.ce-collab-dot--connecting { background: var(--ss-warning); animation: ce-pulse 1s ease-in-out infinite; }
.ce-collab-dot--disconnected { background: var(--ss-danger); }

@keyframes ce-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.codex-editor__content :deep(.ProseMirror) {
  padding: 1rem 1.25rem;
  min-height: 320px;
  outline: none;
  color: var(--ss-text);
  line-height: 1.7;
  font-size: 0.95rem;
}

.codex-editor__content :deep(.ProseMirror > * + *) { margin-top: 0.4em; }
.codex-editor__content :deep(.ProseMirror p) { margin: 0 0 0.65em; }
.codex-editor__content :deep(.ProseMirror h1) { font-size: 1.5rem; font-weight: 700; margin: 1.4em 0 0.4em; line-height: 1.3; }
.codex-editor__content :deep(.ProseMirror h2) { font-size: 1.2rem; font-weight: 700; margin: 1.2em 0 0.35em; line-height: 1.3; }
.codex-editor__content :deep(.ProseMirror h3) { font-size: 1rem; font-weight: 700; margin: 1em 0 0.3em; }
.codex-editor__content :deep(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5em; margin: 0 0 0.65em; }
.codex-editor__content :deep(.ProseMirror li) { margin-bottom: 0.2em; }
.codex-editor__content :deep(.ProseMirror blockquote) { border-left: 3px solid var(--ss-primary); padding-left: 1em; margin: 0 0 0.65em; color: var(--ss-text-muted); }
.codex-editor__content :deep(.ProseMirror code:not(pre *)) { background: var(--ss-parchment-dark); border: 1px solid var(--ss-border); border-radius: 3px; padding: 0.1em 0.35em; font-size: 0.875em; font-family: ui-monospace, monospace; color: var(--ss-primary); }
.codex-editor__content :deep(.ProseMirror pre) { background: var(--ss-parchment-dark); border: 1px solid var(--ss-border); border-radius: var(--ss-radius, 6px); padding: 0.75rem 1rem; overflow-x: auto; margin: 0 0 0.65em; }
.codex-editor__content :deep(.ProseMirror pre code) { background: none; border: none; padding: 0; }
.codex-editor__content :deep(.ProseMirror hr) { border: none; border-top: 1px solid var(--ss-border); margin: 1.5em 0; }

/* Tables */
.codex-editor__content :deep(.ProseMirror table) { width: 100%; border-collapse: collapse; margin: 0 0 1em; }
.codex-editor__content :deep(.ProseMirror th, .ProseMirror td) { border: 1px solid var(--ss-border); padding: 0.4em 0.6em; vertical-align: top; }
.codex-editor__content :deep(.ProseMirror th) { background: var(--ss-parchment-dark); font-weight: 700; text-align: left; }
.codex-editor__content :deep(.ProseMirror .selectedCell::after) { background: color-mix(in srgb, var(--ss-primary) 12%, transparent); content: ''; inset: 0; pointer-events: none; position: absolute; z-index: 2; }
.codex-editor__content :deep(.ProseMirror td, .ProseMirror th) { position: relative; }

/* Mention chip */
.codex-editor__content :deep(.codex-mention) {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border-radius: 4px;
  padding: 0.05em 0.35em;
  font-weight: 500;
  white-space: nowrap;
}
</style>
