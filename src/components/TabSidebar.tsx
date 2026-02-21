import { FileText, Film, BarChart3 } from 'lucide-react';
import type { TabType } from '@/types/screenplay';
import { cn } from '@/lib/utils';

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'synopsis', label: 'Синопсис', icon: FileText },
  { id: 'script', label: 'Сценарий', icon: Film },
  { id: 'statistics', label: 'Статистика', icon: BarChart3 },
];

interface Props {
  active: TabType;
  onTabChange: (t: TabType) => void;
}

export default function TabSidebar({ active, onTabChange }: Props) {
  return (
    <div className="w-16 flex flex-col items-center py-6 gap-1 bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="mb-6">
        <span className="text-xl font-serif font-bold text-primary">K</span>
      </div>
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-xs',
              isActive
                ? 'bg-primary/15 text-primary gold-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            title={t.label}
          >
            <Icon size={20} />
            <span className="text-[10px] leading-none">{t.label.slice(0, 4)}</span>
          </button>
        );
      })}
    </div>
  );
}
