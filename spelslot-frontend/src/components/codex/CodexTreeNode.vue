<script setup lang="ts">
import { ref } from 'vue'
import type { CodexEntry } from '@/services/codexService'

defineOptions({ name: 'CodexTreeNode' })

export interface TreeNode {
  entry: CodexEntry
  children: TreeNode[]
  depth: number
}

const props = defineProps<{
  node: TreeNode
  selectedSlug: string | null
}>()

const emit = defineEmits<{
  select: [slug: string]
}>()

const expanded = ref(props.node.depth === 0)

function toggle(e: MouseEvent) {
  e.stopPropagation()
  expanded.value = !expanded.value
}
</script>

<template>
  <div>
    <button
      class="tree-node"
      :class="{
        'tree-node--selected': selectedSlug === node.entry.slug,
        'tree-node--dm': node.entry.permission === 'DM_ONLY',
        'tree-node--draft': node.entry.status === 'DRAFT',
      }"
      :style="{ paddingLeft: `${0.4 + node.depth * 1}rem` }"
      :title="node.entry.name"
      @click="emit('select', node.entry.slug)"
    >
      <span
        class="tree-node__chevron"
        :style="{ visibility: node.children.length ? 'visible' : 'hidden' }"
        @click.stop="toggle"
      >
        <i :class="['pi', expanded ? 'pi-chevron-down' : 'pi-chevron-right']" />
      </span>
      <span class="tree-node__name">{{ node.entry.name }}</span>
      <span v-if="node.entry.permission === 'DM_ONLY'" class="tree-node__dm">DM</span>
    </button>

    <div v-if="expanded && node.children.length">
      <CodexTreeNode
        v-for="child in node.children"
        :key="child.entry.id"
        :node="child"
        :selected-slug="selectedSlug"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<style>
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
  transition: background 0.1s, color 0.1s;
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
