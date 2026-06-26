import { describe, it, expect } from 'vitest'
import { codexDrag } from './useCodexDrag'

describe('useCodexDrag initial state', () => {
  it('should have null id on initial import', () => {
    expect(codexDrag.id).toBeNull()
  })

  it('should have null parentId on initial import', () => {
    expect(codexDrag.parentId).toBeNull()
  })
})

describe('useCodexDrag mutation', () => {
  it('should update id when assigned', () => {
    // Act
    codexDrag.id = 'entry-abc'

    // Assert
    expect(codexDrag.id).toBe('entry-abc')

    // Cleanup
    codexDrag.id = null
  })

  it('should update parentId when assigned', () => {
    // Act
    codexDrag.parentId = 'parent-xyz'

    // Assert
    expect(codexDrag.parentId).toBe('parent-xyz')

    // Cleanup
    codexDrag.parentId = null
  })

  it('should update both id and parentId simultaneously', () => {
    // Act
    codexDrag.id = 'entry-1'
    codexDrag.parentId = 'parent-1'

    // Assert
    expect(codexDrag.id).toBe('entry-1')
    expect(codexDrag.parentId).toBe('parent-1')

    // Cleanup
    codexDrag.id = null
    codexDrag.parentId = null
  })
})

describe('useCodexDrag reset', () => {
  it('should allow resetting id to null', () => {
    // Arrange
    codexDrag.id = 'some-entry'

    // Act
    codexDrag.id = null

    // Assert
    expect(codexDrag.id).toBeNull()
  })

  it('should allow resetting parentId to null', () => {
    // Arrange
    codexDrag.parentId = 'some-parent'

    // Act
    codexDrag.parentId = null

    // Assert
    expect(codexDrag.parentId).toBeNull()
  })
})

describe('useCodexDrag shared state', () => {
  it('should return the same object reference on each import', async () => {
    // Arrange
    const { codexDrag: codexDragSecond } = await import('./useCodexDrag')

    // Assert
    expect(codexDrag).toBe(codexDragSecond)
  })

  it('should reflect mutations across all references', async () => {
    // Arrange
    const { codexDrag: codexDragSecond } = await import('./useCodexDrag')

    // Act
    codexDrag.id = 'shared-entry'

    // Assert
    expect(codexDragSecond.id).toBe('shared-entry')

    // Cleanup
    codexDrag.id = null
  })
})
