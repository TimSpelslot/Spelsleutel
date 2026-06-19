<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CodexEntry } from '@/services/codexService'

const props = defineProps<{
  items: CodexEntry[]
  command: (item: { id: string; label: string }) => void
}>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

function select(index: number) {
  const item = props.items[index]
  if (item) props.command({ id: item.id, label: item.name })
}

function onKeyDown(event: KeyboardEvent): boolean {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value - 1 + props.items.length) % props.items.length
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    return true
  }
  if (event.key === 'Enter') {
    select(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="mention-list">
    <button
      v-for="(item, i) in items"
      :key="item.id"
      class="mention-list__item"
      :class="{ 'mention-list__item--selected': selectedIndex === i }"
      @click="select(i)"
      @mouseenter="selectedIndex = i"
    >
      <span class="mention-list__name">{{ item.name }}</span>
      <span class="mention-list__type">{{ item.type }}</span>
    </button>
    <div v-if="items.length === 0" class="mention-list__empty">No results</div>
  </div>
</template>

<style scoped>
.mention-list {
  background: var(--ss-surface, #fff);
  border: 1px solid var(--ss-border, #ddd);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  overflow: hidden;
  min-width: 200px;
  max-height: 220px;
  overflow-y: auto;
  padding: 0.2rem;
}

.mention-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
  transition: background 0.1s;
}

.mention-list__item:hover,
.mention-list__item--selected {
  background: color-mix(in srgb, var(--ss-primary, #D97706) 10%, transparent);
}

.mention-list__name {
  color: var(--ss-text, #1a1a1a);
  font-weight: 500;
}

.mention-list__item--selected .mention-list__name {
  color: var(--ss-primary, #D97706);
}

.mention-list__type {
  font-size: 0.7rem;
  color: var(--ss-text-muted, #888);
  text-transform: capitalize;
  flex-shrink: 0;
}

.mention-list__empty {
  padding: 0.75rem;
  text-align: center;
  color: var(--ss-text-muted, #888);
  font-size: 0.85rem;
  font-style: italic;
}
</style>
