import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { allScreenplayNodes } from '@/lib/tiptap/screenplay-nodes';
import { ScreenplayKeymap } from '@/lib/tiptap/screenplay-keymap';
import { ScreenplayAutoformat } from '@/lib/tiptap/screenplay-autoformat';
import FormatDropdown from './FormatDropdown';

interface Props {
  onContentChange?: (text: string) => void;
}

export default function ScriptEditor({ onContentChange }: Props) {
  const { editorContent, setEditorContent, markSaved } = useProjectStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: 'Начните писать сценарий или нажмите «Создать поэпизодник» в панели AI...',
      }),
      ...allScreenplayNodes,
      ScreenplayKeymap,
      ScreenplayAutoformat,
    ],
    content: editorContent || '',
    editorProps: {
      attributes: {
        class: 'min-h-full outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = editor.getText();

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setEditorContent(json);
        markSaved();
      }, 3000);

      onContentChange?.(text);
    },
  });

  useEffect(() => {
    if (editor) {
      (window as any).__kscriptEditor = editor;
    }
    return () => {
      delete (window as any).__kscriptEditor;
    };
  }, [editor]);

  return (
    <div className="screenplay-editor h-full flex flex-col overflow-hidden bg-screenplay-bg rounded-lg border border-border">
      <FormatDropdown editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
