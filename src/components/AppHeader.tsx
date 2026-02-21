import { Save, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';

export default function AppHeader() {
  const { title, lastSaved } = useProjectStore();
  const displayTitle = title || 'Без названия';

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/50 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-serif font-bold text-primary tracking-wide">kscript AI</h1>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-sm text-foreground truncate max-w-64">{displayTitle}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {lastSaved ? (
          <>
            <CheckCircle2 size={14} className="text-success" />
            <span>Сохранено</span>
          </>
        ) : (
          <>
            <Save size={14} />
            <span>Автосохранение</span>
          </>
        )}
      </div>
    </header>
  );
}
