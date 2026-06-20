import { reactive } from 'vue'

// Shared across all CodexTreeNode instances on the page so any node can
// check what is being dragged without prop-drilling.
export const codexDrag = reactive({
  id: null as string | null,
  parentId: null as string | null,
})
