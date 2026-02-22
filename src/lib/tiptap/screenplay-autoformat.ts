import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { detectNodeType, type ScreenplayNodeType } from './screenplay-nodes';

/**
 * Auto-detects and converts paragraph nodes to screenplay types as user types.
 */
export const ScreenplayAutoformat = Extension.create({
  name: 'screenplayAutoformat',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('screenplayAutoformat'),
        appendTransaction(transactions, _oldState, newState) {
          // Only process if doc changed
          if (!transactions.some((t) => t.docChanged)) return null;

          const { selection } = newState;
          const { $from } = selection;
          const node = $from.parent;

          // Only auto-format paragraph nodes
          if (node.type.name !== 'paragraph') return null;

          const text = node.textContent;
          if (!text || text.length < 3) return null;

          // Get previous sibling type
          const pos = $from.before();
          const resolvedPos = newState.doc.resolve(pos);
          let prevType: ScreenplayNodeType | undefined;
          if (resolvedPos.index(resolvedPos.depth - 1) > 0) {
            const prevNode = resolvedPos.node(resolvedPos.depth - 1).child(
              resolvedPos.index(resolvedPos.depth - 1) - 1
            );
            if (prevNode) {
              prevType = prevNode.type.name as ScreenplayNodeType;
            }
          }

          const detected = detectNodeType(text, prevType);
          if (!detected) return null;

          const nodeType = newState.schema.nodes[detected];
          if (!nodeType) return null;

          const tr = newState.tr;
          tr.setNodeMarkup(pos, nodeType);
          return tr;
        },
      }),
    ];
  },
});
