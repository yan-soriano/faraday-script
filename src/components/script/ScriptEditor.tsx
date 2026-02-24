import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';
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
  const [pageCount, setPageCount] = useState<number>(1);

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

      const lines = text.split('\n').length || 0;
      const estimatedPages = Math.max(1, Math.round(lines / 50)); // ~50 строк на страницу
      setPageCount(estimatedPages);

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
    <div className="screenplay-editor h-full flex flex-col overflow-hidden bg-muted/40 rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-2">
        <FormatDropdown editor={editor} />
        <div className="text-[11px] text-muted-foreground px-2 py-1">
          Хронометраж: <span className="font-semibold">{pageCount}</span> мин (
          {pageCount} стр.)
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex justify-center py-4">
          <div className="bg-background shadow-lg rounded-md px-10 py-10 w-[800px] min-h-[1000px]">
            <EditorContent editor={editor} className="h-full prose max-w-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
