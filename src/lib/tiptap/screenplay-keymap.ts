import { Extension } from '@tiptap/core';
import { detectNodeType, ENTER_NEXT, TAB_NEXT, type ScreenplayNodeType } from './screenplay-nodes';

function getActiveNodeType(editor: any): ScreenplayNodeType | 'paragraph' {
  const types: ScreenplayNodeType[] = [
    'sceneHeading', 'sceneParticipants', 'action',
    'characterCue', 'dialogue', 'parenthetical', 'transition',
  ];
  for (const t of types) {
    if (editor.isActive(t)) return t;
  }
  return 'paragraph';
}

export const ScreenplayKeymap = Extension.create({
  name: 'screenplayKeymap',

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const current = getActiveNodeType(editor);
        const next = TAB_NEXT[current as ScreenplayNodeType];
        if (next) {
          return editor.commands.setNode(next);
        }
        // From paragraph/action, go to characterCue
        if (current === 'paragraph') {
          return editor.commands.setNode('characterCue');
        }
        return false;
      },

      Enter: ({ editor }) => {
        const current = getActiveNodeType(editor);

        // Auto-detect formatting on current node text
        const { $from } = editor.state.selection;
        const text = $from.parent.textContent;
        const detected = detectNodeType(text, current === 'paragraph' ? undefined : current as ScreenplayNodeType);

        if (detected && current === 'paragraph') {
          // Convert current node, then split
          editor.commands.setNode(detected);
        }

        const next = ENTER_NEXT[current as ScreenplayNodeType];
        if (next) {
          // Split then convert new node
          const chain = editor.chain().splitBlock();
          chain.setNode(next);
          return chain.run();
        }

        // Default: split and go to action/paragraph
        if (['characterCue', 'parenthetical', 'transition'].includes(current)) {
          return editor.chain().splitBlock().setNode('action').run();
        }

        return false;
      },
    };
  },
});
