import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Editor } from '@tiptap/react';
import type { ScreenplayNodeType } from '@/lib/tiptap/screenplay-nodes';

const FORMAT_OPTIONS: { value: ScreenplayNodeType | 'paragraph'; label: string; shortcut?: string }[] = [
  { value: 'sceneHeading', label: 'Место и время', shortcut: '' },
  { value: 'sceneParticipants', label: 'Участники сцены' },
  { value: 'action', label: 'Описание действия' },
  { value: 'characterCue', label: 'Герой', shortcut: 'Tab' },
  { value: 'dialogue', label: 'Диалог' },
  { value: 'parenthetical', label: 'Ремарка' },
  { value: 'transition', label: 'Переход' },
];

function getActiveFormat(editor: Editor): string {
  for (const opt of FORMAT_OPTIONS) {
    if (editor.isActive(opt.value)) return opt.label;
  }
  return 'Описание действия';
}

interface Props {
  editor: Editor | null;
}

export default function FormatDropdown({ editor }: Props) {
  if (!editor) return null;

  const activeLabel = getActiveFormat(editor);

  const handleSelect = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setNode('paragraph').run();
    } else {
      editor.chain().focus().setNode(value).run();
    }
  };

  return (
    <div className="flex items-center h-9 px-2 border-b border-border bg-card/50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs font-mono text-foreground">
            {activeLabel}
            <ChevronDown size={12} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {FORMAT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex justify-between text-xs"
            >
              <span>{opt.label}</span>
              {opt.shortcut && (
                <span className="text-muted-foreground text-[10px]">{opt.shortcut}</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
