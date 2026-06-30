<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Mention from '@tiptap/extension-mention'
import { SecretBlock } from '@/extensions/SecretBlock'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  content: unknown
}>()

const emit = defineEmits<{
  navigate: [slug: string]
}>()

const auth = useAuthStore()

// Node types native to Tiptap's StarterKit + our extensions.
const NATIVE_NODES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'blockquote',
  'bulletList',
  'bullet_list',
  'orderedList',
  'ordered_list',
  'listItem',
  'list_item',
  'codeBlock',
  'code_block',
  'horizontalRule',
  'horizontal_rule',
  'hardBreak',
  'hard_break',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'mention',
])

// LK (Atlassian Editor) block nodes that can be downgraded to blockquote
// so their children remain visible instead of being silently stripped.
const DEGRADE_TO_BLOCKQUOTE = new Set([
  'panel',
  'expand',
  'nestedExpand',
  'bodiedExtension',
  'layoutSection',
  'layoutColumn',
  'taskList',
  'decisionList',
])

// LK block nodes whose children we lift directly (transparent wrappers).
const TRANSPARENT_NODES = new Set(['taskItem', 'decisionItem'])

interface PmNode {
  type: string
  content?: PmNode[]
  marks?: unknown[]
  text?: string
  attrs?: unknown
  [key: string]: unknown
}

// Returns an array so that transparent / degraded nodes can contribute
// multiple children to their parent's content list.
function sanitize(node: PmNode, isStoryDm: boolean): PmNode[] {
  // Secret blocks: strip entirely for non-StoryDM users
  if (node.type === 'secretBlock') {
    if (!isStoryDm) return []
    return [{ ...node, content: (node.content ?? []).flatMap((n) => sanitize(n, isStoryDm)) }]
  }

  if (NATIVE_NODES.has(node.type)) {
    if (!node.content) return [node]
    return [{ ...node, content: node.content.flatMap((n) => sanitize(n, isStoryDm)) }]
  }

  if (DEGRADE_TO_BLOCKQUOTE.has(node.type)) {
    const children = (node.content ?? []).flatMap((n) => sanitize(n, isStoryDm))
    if (!children.length) return []
    return [{ type: 'blockquote', content: children }]
  }

  if (TRANSPARENT_NODES.has(node.type)) {
    return (node.content ?? []).flatMap((n) => sanitize(n, isStoryDm))
  }

  // Unknown inline nodes: keep text content as plain text
  if (node.type === 'text' || (node.text && typeof node.text === 'string')) {
    return [{ type: 'text', text: node.text as string }]
  }

  // Unknown node with children: lift children directly
  if (node.content && node.content.length > 0) {
    return node.content.flatMap((n) => sanitize(n, isStoryDm))
  }

  return []
}

function prepare(raw: unknown): object | null {
  if (!raw || typeof raw !== 'object') return null
  const root = raw as PmNode
  if (root.type !== 'doc') return null
  const isStoryDm = auth.effectiveUser?.isStoryDm ?? false
  return {
    type: 'doc',
    content: (root.content ?? []).flatMap((n) => sanitize(n, isStoryDm)),
  }
}

const editor = useEditor({
  content: prepare(props.content) ?? undefined,
  editable: false,
  extensions: [
    StarterKit,
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Mention.configure({
      HTMLAttributes: { class: 'codex-mention' },
    }),
    SecretBlock,
  ],
})

watch(
  () => props.content,
  (next) => {
    const content = prepare(next)
    if (editor.value && content) {
      editor.value.commands.setContent(content as object)
    }
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function handleClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('[data-type="mention"]')
  if (!target) return
  const slug = target.getAttribute('data-id')
  if (slug) emit('navigate', slug)
}
</script>

<template>
  <div class="tiptap-renderer" @click="handleClick">
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.tiptap-renderer :deep(.ProseMirror) {
  outline: none;
  color: var(--ss-text);
  line-height: 1.7;
  font-size: 0.95rem;
}

.tiptap-renderer :deep(.ProseMirror h1),
.tiptap-renderer :deep(.ProseMirror h2),
.tiptap-renderer :deep(.ProseMirror h3) {
  color: var(--ss-text);
  font-weight: 700;
  margin: 1.4em 0 0.5em;
  line-height: 1.3;
}

.tiptap-renderer :deep(.ProseMirror h1) {
  font-size: 1.5rem;
}
.tiptap-renderer :deep(.ProseMirror h2) {
  font-size: 1.2rem;
}
.tiptap-renderer :deep(.ProseMirror h3) {
  font-size: 1rem;
}

.tiptap-renderer :deep(.ProseMirror p) {
  margin: 0 0 0.75em;
}

.tiptap-renderer :deep(.ProseMirror ul),
.tiptap-renderer :deep(.ProseMirror ol) {
  padding-left: 1.5em;
  margin: 0 0 0.75em;
}

.tiptap-renderer :deep(.ProseMirror li) {
  margin-bottom: 0.2em;
}

.tiptap-renderer :deep(.ProseMirror strong) {
  font-weight: 700;
  color: var(--ss-text);
}

.tiptap-renderer :deep(.ProseMirror code) {
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: 3px;
  padding: 0.1em 0.35em;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
  color: var(--ss-primary);
}

.tiptap-renderer :deep(.ProseMirror pre) {
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0 0 0.75em;
}

.tiptap-renderer :deep(.ProseMirror pre code) {
  background: none;
  border: none;
  padding: 0;
  color: var(--ss-text);
}

.tiptap-renderer :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--ss-primary);
  padding-left: 1em;
  margin: 0 0 0.75em;
  color: var(--ss-text-muted);
}

.tiptap-renderer :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--ss-border);
  margin: 1.5em 0;
}

/* Tables */
.tiptap-renderer :deep(.ProseMirror table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1em;
}

.tiptap-renderer :deep(.ProseMirror th),
.tiptap-renderer :deep(.ProseMirror td) {
  border: 1px solid var(--ss-border);
  padding: 0.4em 0.6em;
  vertical-align: top;
}

.tiptap-renderer :deep(.ProseMirror th) {
  background: var(--ss-parchment-dark);
  font-weight: 700;
  text-align: left;
}

/* Secret block (DM Only — only rendered for StoryDM users, stripped for others) */
.tiptap-renderer :deep(.secret-block) {
  background: color-mix(in srgb, var(--ss-dm-color, #7c3aed) 8%, transparent);
  border-left: 3px solid var(--ss-dm-color, #7c3aed);
  border-radius: var(--ss-radius, 6px);
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  margin: 0.75em 0;
}
.tiptap-renderer :deep(.secret-block::before) {
  content: '🔒 DM Only';
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ss-dm-color, #7c3aed);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

/* Mention chip */
.tiptap-renderer :deep(.codex-mention) {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-primary);
  border-radius: 4px;
  padding: 0.05em 0.35em;
  font-weight: 500;
}
</style>
