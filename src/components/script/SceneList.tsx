import { Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SceneListItem {
  index: number;
  heading: string;
  descriptionPreview?: string;
}

interface Props {
  scenes: SceneListItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export default function SceneList({ scenes, selectedIndex, onSelect }: Props) {
  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-4 text-center">
        <Hash size={24} className="mb-2 opacity-40" />
        <p>Сцены появятся после создания поэпизодника</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2">
          Сцены ({scenes.length})
        </div>
        {scenes.map((s) => (
          <button
            key={s.index}
            onClick={() => onSelect(s.index)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
              selectedIndex === s.index
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            <span className="text-[10px] text-muted-foreground mr-1.5">{s.index}.</span>
            <span className="font-medium truncate block">
              {s.heading.replace(/^(ИНТ\.|ЭКСТ\.|НАТ\.)\s*/i, '').slice(0, 35)}
            </span>
            {s.descriptionPreview != null && s.descriptionPreview.length > 0 && (
              <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 block">
                {s.descriptionPreview.slice(0, 200)}
                {s.descriptionPreview.length > 200 ? '…' : ''}
              </span>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
