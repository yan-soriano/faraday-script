import { Save, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { Button } from '@/components/ui/button';
import { exportScreenplayDocx } from '@/lib/export-docx';
import { useToast } from '@/hooks/use-toast';

export default function AppHeader() {
  const { title, lastSaved, editorContent } = useProjectStore();
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const displayTitle = title || 'Без названия';

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScreenplayDocx(title || 'Без названия', editorContent);
      toast({ title: 'Экспорт завершён', description: 'Файл .docx скачан' });
    } catch (e: any) {
      toast({ title: 'Ошибка экспорта', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/50 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-serif font-bold text-primary tracking-wide">kscript AI</h1>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-sm text-foreground truncate max-w-64">{displayTitle}</span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Скачать .docx
        </Button>
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
      </div>
    </header>
  );
}
