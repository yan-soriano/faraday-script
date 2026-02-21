import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';

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
        placeholder: 'Начните писать сценарий или нажмите «Создать поэпизодник» в панели AI...\n\nИНТ. ШКОЛА — ДЕНЬ\nАЙДАР, ДАНА, ЕРЛАН\nДети входят в класс и обнаруживают...',
      }),
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

      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setEditorContent(json);
        markSaved();
      }, 3000);

      onContentChange?.(text);
    },
  });

  // Expose editor globally for AI panel insertion
  useEffect(() => {
    if (editor) {
      (window as any).__kscriptEditor = editor;
    }
    return () => {
      delete (window as any).__kscriptEditor;
    };
  }, [editor]);

  return (
    <div className="screenplay-editor h-full overflow-y-auto bg-screenplay-bg rounded-lg border border-border">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}
