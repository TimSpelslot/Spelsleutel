<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { generateKeyBetween } from 'fractional-indexing'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import CodexTreeNode, { type TreeNode } from '@/components/codex/CodexTreeNode.vue'
import CodexDetailPanel from '@/components/codex/CodexDetailPanel.vue'
import { codexService, type CodexEntry, type EntryType } from '@/services/codexService'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const canCreateEntry = computed(() => {
  const u = auth.effectiveUser
  if (!u) return false
  return u.role === 'DM' || u.role === 'ADMIN' || u.isWorldbuilder
})

const canReorder = computed(() => {
  const role = auth.effectiveUser?.role
  return role === 'DM' || role === 'ADMIN'
})

// ── State ─────────────────────────────────────────────────────────────────

const entries = ref<CodexEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const treeCollapsed = ref(false)
const selectedSlug = ref<string | null>((route.query.entry as string) || null)

// Which type groups are expanded (all open by default)
const expandedTypes = ref(new Set<string>(['lore', 'location', 'npc', 'faction', 'item', 'event', 'rule', 'session']))

onMounted(async () => {
  loading.value = true
  const result = await codexService.listEntries()
  loading.value = false
  if (result.type === 'ok') entries.value = result.data
  else error.value = result.message
})

// ── Tree building ─────────────────────────────────────────────────────────

const treeGroups = computed(() => {
  const q = search.value.toLowerCase()
  const filtered = q
    ? entries.value.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : entries.value

  const nodeMap = new Map<string, TreeNode>()
  for (const entry of filtered) {
    nodeMap.set(entry.id, { entry, children: [], depth: 0 })
  }

  const roots: TreeNode[] = []
  for (const entry of filtered) {
    const node = nodeMap.get(entry.id)!
    const parent = entry.parentId ? nodeMap.get(entry.parentId) : null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function assignDepth(node: TreeNode, d: number) {
    node.depth = d
    node.children.sort((a, b) => a.entry.pos.localeCompare(b.entry.pos))
    for (const child of node.children) assignDepth(child, d + 1)
  }

  roots.sort((a, b) => a.entry.pos.localeCompare(b.entry.pos))
  for (const root of roots) assignDepth(root, 0)

  const groups = new Map<EntryType, TreeNode[]>()
  for (const node of roots) {
    const type = node.entry.type
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type)!.push(node)
  }

  return groups
})

// ── Type meta ─────────────────────────────────────────────────────────────

const TYPE_META: Record<EntryType, { label: string; icon: string }> = {
  lore:     { label: 'Lore',     icon: 'pi-book' },
  location: { label: 'Location', icon: 'pi-map-marker' },
  npc:      { label: 'NPC',      icon: 'pi-user' },
  faction:  { label: 'Faction',  icon: 'pi-users' },
  item:     { label: 'Item',     icon: 'pi-star' },
  event:    { label: 'Event',    icon: 'pi-calendar' },
  rule:     { label: 'Rule',     icon: 'pi-file' },
  session:  { label: 'Session',  icon: 'pi-play' },
}

const TYPE_ORDER: EntryType[] = ['lore', 'location', 'npc', 'faction', 'item', 'event', 'rule', 'session']

const orderedGroups = computed(() =>
  TYPE_ORDER.filter((t) => treeGroups.value.has(t)).map((t) => ({
    type: t,
    meta: TYPE_META[t],
    nodes: treeGroups.value.get(t)!,
  })),
)

// ── Actions ───────────────────────────────────────────────────────────────

function selectEntry(slug: string) {
  selectedSlug.value = slug
  router.replace({ query: { entry: slug } })
}

function toggleType(type: string) {
  if (expandedTypes.value.has(type)) expandedTypes.value.delete(type)
  else expandedTypes.value.add(type)
}

function navigateRelation(slug: string) {
  selectEntry(slug)
}

async function handleReorder({
  draggedId,
  targetId,
  position,
}: {
  draggedId: string
  targetId: string
  position: 'before' | 'after'
}) {
  const dragged = entries.value.find((e) => e.id === draggedId)
  const target  = entries.value.find((e) => e.id === targetId)
  if (!dragged || !target || dragged.parentId !== target.parentId) return

  // Sorted siblings excluding the dragged entry
  const siblings = entries.value
    .filter((e) => e.parentId === target.parentId && e.id !== draggedId)
    .sort((a, b) => (a.pos ?? '').localeCompare(b.pos ?? ''))

  const targetIdx = siblings.findIndex((e) => e.id === targetId)

  // Empty strings are not valid fractional-indexing keys — treat as null
  const safePos = (p: string | null | undefined): string | null =>
    p && p.length > 0 ? p : null

  const beforePos = safePos(position === 'before' ? siblings[targetIdx - 1]?.pos : target.pos)
  const afterPos  = safePos(position === 'before' ? target.pos : siblings[targetIdx + 1]?.pos)

  const originalPos = dragged.pos
  try {
    const newPos = generateKeyBetween(beforePos, afterPos)
    dragged.pos = newPos
    await codexService.updateEntry(draggedId, { pos: newPos })
  } catch {
    dragged.pos = originalPos
    toast.add({ severity: 'error', summary: 'Reorder failed', detail: 'Could not save the new position. Try again.', life: 4000 })
  }
}
</script>

<template>
  <div class="codex-layout" :class="{ 'codex-layout--tree-collapsed': treeCollapsed }">

    <!-- ── Tree panel ── -->
    <aside class="codex-tree">

      <!-- Tree header + collapse toggle -->
      <div class="codex-tree__header">
        <span v-if="!treeCollapsed" class="codex-tree__title">Codex</span>
        <Button
          v-if="!treeCollapsed && canCreateEntry"
          icon="pi pi-plus"
          text
          size="small"
          class="codex-tree__new-btn"
          title="New entry"
          @click="router.push({ name: 'codex-new' })"
        />
        <button
          class="codex-tree__toggle"
          :title="treeCollapsed ? 'Expand tree' : 'Collapse tree'"
          @click="treeCollapsed = !treeCollapsed"
        >
          <i :class="['pi', treeCollapsed ? 'pi-chevron-right' : 'pi-chevron-left']" />
        </button>
      </div>

      <!-- Search (hidden when collapsed) -->
      <div v-if="!treeCollapsed" class="codex-tree__search">
        <i class="pi pi-search codex-tree__search-icon" aria-hidden="true" />
        <InputText
          v-model="search"
          placeholder="Search…"
          class="codex-tree__search-input"
          size="small"
        />
      </div>

      <!-- Tree content -->
      <div v-if="!treeCollapsed" class="codex-tree__scroll">

        <!-- Loading -->
        <div v-if="loading" class="codex-tree__skeletons">
          <Skeleton v-for="n in 12" :key="n" height="22px" border-radius="4px" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="codex-tree__message">
          <i class="pi pi-exclamation-circle" style="color: var(--ss-danger)" />
          <span>{{ error }}</span>
        </div>

        <!-- Empty -->
        <div v-else-if="orderedGroups.length === 0" class="codex-tree__message">
          {{ search ? 'No results.' : 'No entries.' }}
        </div>

        <!-- Groups -->
        <div v-else>
          <div v-for="group in orderedGroups" :key="group.type" class="codex-group">
            <button class="codex-group__heading" @click="toggleType(group.type)">
              <i :class="['pi', group.meta.icon]" aria-hidden="true" />
              <span>{{ group.meta.label }}</span>
              <span class="codex-group__count">{{ group.nodes.length }}</span>
              <i
                :class="['pi', 'codex-group__chevron', expandedTypes.has(group.type) ? 'pi-chevron-down' : 'pi-chevron-right']"
                aria-hidden="true"
              />
            </button>

            <div v-if="expandedTypes.has(group.type)" class="codex-group__entries">
              <CodexTreeNode
                v-for="node in group.nodes"
                :key="node.entry.id"
                :node="node"
                :selected-slug="selectedSlug"
                :can-reorder="canReorder"
                @select="selectEntry"
                @reorder="handleReorder"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Collapsed: just type icons as nav -->
      <div v-else class="codex-tree__collapsed-icons">
        <button
          v-for="group in orderedGroups"
          :key="group.type"
          class="codex-tree__icon-btn"
          :title="group.meta.label"
          @click="treeCollapsed = false"
        >
          <i :class="['pi', group.meta.icon]" />
        </button>
      </div>
    </aside>

    <!-- ── Detail panel ── -->
    <main class="codex-detail">
      <CodexDetailPanel
        :slug="selectedSlug"
        @navigate="navigateRelation"
      />
    </main>

  </div>
</template>

<style scoped>
/* Escape AppLayout padding and fill the content area */
.codex-layout {
  display: flex;
  margin: -1.5rem;
  height: calc(100vh - var(--ss-navbar-height));
  overflow: hidden;
}

/* ── Tree panel ── */
.codex-tree {
  width: 260px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  background: var(--ss-shell-lighter);
  border-right: 1px solid color-mix(in srgb, var(--ss-border) 40%, transparent);
  transition: width 0.22s ease, min-width 0.22s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.codex-layout--tree-collapsed .codex-tree {
  width: 44px;
  min-width: 44px;
}

.codex-tree__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.5rem 0.65rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ss-border) 25%, transparent);
  flex-shrink: 0;
  min-height: 44px;
}

.codex-tree__title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ss-shell-fg-muted);
}

.codex-tree__toggle {
  background: none;
  border: none;
  color: var(--ss-shell-fg-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  transition: color 0.1s;
}

.codex-tree__toggle:hover { color: var(--ss-shell-fg); }

.codex-tree__new-btn {
  color: var(--ss-shell-fg-muted) !important;
  padding: 2px 4px !important;
  margin-left: auto;
  font-size: 0.7rem !important;
}
.codex-tree__new-btn:hover { color: var(--ss-primary) !important; }

/* Search */
.codex-tree__search {
  position: relative;
  padding: 0.5rem;
  flex-shrink: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ss-border) 20%, transparent);
}

.codex-tree__search-icon {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: var(--ss-shell-fg-muted);
  pointer-events: none;
}

.codex-tree__search-input {
  width: 100%;
  padding-left: 1.8rem !important;
  font-size: 0.78rem !important;
  background: color-mix(in srgb, var(--ss-shell) 60%, transparent) !important;
  border-color: color-mix(in srgb, var(--ss-border) 30%, transparent) !important;
  color: var(--ss-shell-fg) !important;
  height: 30px !important;
}

/* Scroll area */
.codex-tree__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: var(--ss-shell) transparent;
}

/* Loading skeletons */
.codex-tree__skeletons {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 0.25rem;
}

/* Message */
.codex-tree__message {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 0.5rem;
  font-size: 0.78rem;
  color: var(--ss-shell-fg-muted);
}

/* Collapsed icons */
.codex-tree__collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.4rem 0;
  overflow-y: auto;
}

.codex-tree__icon-btn {
  background: none;
  border: none;
  color: var(--ss-shell-fg-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  font-size: 0.85rem;
  width: 34px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, background 0.1s;
}

.codex-tree__icon-btn:hover {
  color: var(--ss-shell-fg);
  background: color-mix(in srgb, var(--ss-shell-fg) 12%, transparent);
}

/* ── Type groups ── */
.codex-group {
  margin-bottom: 2px;
}

.codex-group__heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.2rem 0.4rem;
  background: none;
  border: none;
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ss-shell-fg-muted);
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  transition: color 0.1s;
}

.codex-group__heading:hover { color: var(--ss-shell-fg); }

.codex-group__heading .pi:first-child { color: var(--ss-primary); font-size: 0.7rem; }

.codex-group__count {
  background: color-mix(in srgb, var(--ss-shell-fg) 10%, transparent);
  border-radius: 99px;
  padding: 0 0.35em;
  font-size: 0.6rem;
  color: var(--ss-shell-fg-muted);
}

.codex-group__chevron {
  margin-left: auto;
  font-size: 0.6rem;
}

.codex-group__entries {
  padding-left: 0.1rem;
}

/* ── Detail panel ── */
.codex-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background: var(--ss-parchment);
  display: flex;
  flex-direction: column;
}

@media (max-width: 767px) {
  .codex-layout {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - var(--ss-navbar-height));
  }

  .codex-tree {
    width: 100% !important;
    min-width: 0 !important;
    max-height: 280px;
  }

  .codex-layout--tree-collapsed .codex-tree {
    max-height: 44px;
    width: 100% !important;
  }
}
</style>
