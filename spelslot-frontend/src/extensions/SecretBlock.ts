import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    secretBlock: {
      toggleSecretBlock: () => ReturnType
    }
  }
}

export const SecretBlock = Node.create({
  name: 'secretBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="secret-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'secret-block', class: 'secret-block' }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleSecretBlock:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    }
  },
})
