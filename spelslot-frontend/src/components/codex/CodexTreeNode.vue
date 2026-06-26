<script setup lang="ts">
import { ref } from 'vue'
import type { CodexEntry } from '@/services/codexService'
import { codexDrag } from '@/composables/useCodexDrag'

defineOptions({ name: 'CodexTreeNode' })

export interface TreeNode {
  entry: CodexEntry
  children: TreeNode[]
  depth: number
}

const props = defineProps<{
  node: TreeNode
  selectedSlug: string | null
  canReorder: boolean
}>()

const emit = defineEmits<{
  select: [slug: string]
  reorder: [payload: { draggedId: string; targetId: string; position: 'before' | 'after' }]
}>()

const expanded = ref(props.node.depth === 0)

function toggle(e: MouseEvent) {
  e.stopPropagation()
  expanded.value = !expanded.value
}

// ── Per-node drop indicator ────────────────────────────────────────────────
const dropTarget = ref<'before' | 'after' | null>(null)

function onDragStart(e: DragEvent) {
  codexDrag.id = props.node.entry.id
  codexDrag.parentId = props.node.entry.parentId ?? null
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragEnd() {
  codexDrag.id = null
  codexDrag.parentId = null
  dropTarget.value = null
}

function onDragOver(e: DragEvent) {
  if (
    !codexDrag.id ||
    codexDrag.id === props.node.entry.id ||
    codexDrag.parentId !== (props.node.entry.parentId ?? null)
  )
    return

  dropTarget.value =
    e.offsetY < (e.currentTarget as HTMLElement).offsetHeight / 2 ? 'before' : 'after'
}

function onDragLeave() {
  dropTarget.value = null
}

function onDrop() {
  if (
    !codexDrag.id ||
    codexDrag.id === props.node.entry.id ||
    codexDrag.parentId !== (props.node.entry.parentId ?? null) ||
    !dropTarget.value
  )
    return

  emit('reorder', {
    draggedId: codexDrag.id,
    targetId: props.node.entry.id,
    position: dropTarget.value,
  })

  codexDrag.id = null
  codexDrag.parentId = null
  dropTarget.value = null
}
</script>

<template>
  <div>
    <div
      class="tree-node-wrap"
      :class="{
        'drop-before': dropTarget === 'before',
        'drop-after': dropTarget === 'after',
      }"
    >
      <button
        class="tree-node"
        :class="{
          'tree-node--selected': selectedSlug === node.entry.slug,
          'tree-node--dm': node.entry.permission === 'DM_ONLY',
          'tree-node--draft': node.entry.status === 'DRAFT',
        }"
        :style="{ paddingLeft: `${0.4 + node.depth * 1}rem` }"
        :title="node.entry.name"
        :draggable="canReorder"
        @click="emit('select', node.entry.slug)"
        @dragstart.stop="onDragStart"
        @dragend="onDragEnd"
        @dragover.prevent.stop="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent.stop="onDrop"
      >
        <span
          class="tree-node__chevron"
          :style="{ visibility: node.children.length ? 'visible' : 'hidden' }"
          @click.stop="toggle"
        >
          <i :class="['pi', expanded ? 'pi-chevron-down' : 'pi-chevron-right']" />
        </span>
        <span class="tree-node__name">{{ node.entry.name }}</span>
        <span v-if="node.entry.permission === 'DM_ONLY'" class="tree-node__dm">{{
          $t('common.dm')
        }}</span>
      </button>
    </div>

    <div v-if="expanded && node.children.length">
      <CodexTreeNode
        v-for="child in node.children"
        :key="child.entry.id"
        :node="child"
        :selected-slug="selectedSlug"
        :can-reorder="canReorder"
        @select="emit('select', $event)"
        @reorder="emit('reorder', $event)"
      />
    </div>
  </div>
</template>

<style>
.tree-node-wrap {
  position: relative;
}

.tree-node-wrap.drop-before::before,
.tree-node-wrap.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--ss-primary);
  z-index: 10;
}

.tree-node-wrap.drop-before::before {
  top: 0;
}

.tree-node-wrap.drop-after::after {
  bottom: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  padding-top: 0.2rem;
  padding-bottom: 0.2rem;
  padding-right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 0.8rem;
  color: var(--ss-shell-fg-muted);
  border-radius: 4px;
  transition:
    background 0.1s,
    color 0.1s;
  min-height: 26px;
  white-space: nowrap;
}

.tree-node:hover {
  background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
  color: var(--ss-shell-fg);
}

.tree-node--selected {
  background: color-mix(in srgb, var(--ss-primary) 18%, transparent);
  color: var(--ss-primary);
  font-weight: 600;
}

.tree-node--dm {
  opacity: 0.7;
}

.tree-node--draft {
  opacity: 0.5;
}

.tree-node__chevron {
  flex-shrink: 0;
  width: 14px;
  color: var(--ss-shell-fg-muted);
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 3px;
}

.tree-node__chevron:hover {
  background: color-mix(in srgb, var(--ss-shell-fg) 15%, transparent);
}

.tree-node__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node__dm {
  flex-shrink: 0;
  font-size: 0.55rem;
  font-weight: 700;
  padding: 0.05em 0.3em;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ss-warning) 20%, transparent);
  color: var(--ss-warning);
  letter-spacing: 0.03em;
}
</style>
