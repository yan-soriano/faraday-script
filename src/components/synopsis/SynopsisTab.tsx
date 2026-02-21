import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore } from '@/stores/useProjectStore';
import { validateSynopsis } from '@/lib/validation';
import CharacterTable from './CharacterTable';

export default function SynopsisTab() {
  const { title, synopsis, characters, setTitle, setSynopsis } = useProjectStore();
  const validations = validateSynopsis(title, synopsis, characters);
  const errors = validations.filter((v) => v.type === 'error');
  const warnings = validations.filter((v) => v.type === 'warning');
  const isValid = errors.length === 0;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-serif font-bold text-foreground mb-1">Синопсис проекта</h2>
        <p className="text-xs text-muted-foreground">
          Заполните основную информацию для доступа к AI генерации
        </p>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Название сценария
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Приключения в Астане"
          className="bg-input text-sm"
        />
      </div>

      {/* Synopsis */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Синопсис
          </label>
          <span className="text-xs text-muted-foreground">{synopsis.length} символов</span>
        </div>
        <Textarea
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          placeholder="Опишите сюжет вашего сценария (рекомендуется минимум 200 символов)..."
          rows={6}
          className="bg-input text-sm resize-y"
        />
      </div>

      {/* Characters */}
      <CharacterTable />

      {/* Validation status */}
      <div className="space-y-2 pt-2">
        {isValid ? (
          <div className="flex items-center gap-2 text-success text-xs p-3 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle2 size={16} />
            <span>Синопсис валиден — генерация доступна</span>
          </div>
        ) : null}
        {errors.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-destructive text-xs p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle size={14} />
            <span>{e.message}</span>
          </div>
        ))}
        {warnings.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-primary text-xs p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <AlertCircle size={14} />
            <span>{w.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
