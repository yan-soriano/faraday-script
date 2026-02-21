import { BarChart3, Users, MapPin, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { parseScenes, extractLocations } from '@/lib/screenplay-parser';
import { validateScript } from '@/lib/validation';
import type { ParsedScene, CharacterStats } from '@/types/screenplay';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export default function StatisticsTab() {
  const { editorContent, characters } = useProjectStore();

  const stats = useMemo(() => {
    const text =
      editorContent?.content
        ?.map((n: any) => n.content?.map((c: any) => c.text || '').join('') || '')
        .join('\n') || '';

    const scenes = parseScenes(text);
    const locations = extractLocations(scenes);
    const validations = validateScript(scenes, characters);

    const scenesWithDialogue = scenes.filter((s) => s.hasDialogue).length;
    const totalDialogues = scenes.reduce((sum, s) => sum + s.dialogueCount, 0);

    // Character stats
    const charStats: CharacterStats[] = characters.map((c) => {
      const upper = c.name.toUpperCase();
      const participationScenes = scenes.filter(
        (s) => s.participants.some((p) => p.toUpperCase() === upper) || s.speakingCharacters.includes(upper)
      );
      const dialogueScenes = scenes.filter((s) => s.speakingCharacters.includes(upper));
      const dialogueCount = scenes.reduce(
        (sum, s) => sum + s.speakingCharacters.filter((sc) => sc === upper).length,
        0
      );

      const warnings: string[] = [];
      if (c.roleType === 'main' && participationScenes.length < 19) warnings.push('Мало сцен');
      if (c.roleType === 'main' && participationScenes.length > 21) warnings.push('Много сцен');
      if (c.roleType === 'secondary' && participationScenes.length >= 10) warnings.push('≥10 сцен');
      if (c.roleType === 'adult' && participationScenes.length > 20) warnings.push('>20 сцен');

      return {
        name: c.name || '(без имени)',
        roleType: c.roleType,
        totalDialogues: dialogueCount,
        scenesWithParticipation: participationScenes.length,
        scenesWithoutDialogue: participationScenes.length - dialogueScenes.length,
        status: warnings.length > 0 ? 'warning' : 'ok',
        warnings,
      };
    });

    const uniqueCharsInScript = new Set<string>();
    scenes.forEach((s) => {
      s.participants.forEach((p) => uniqueCharsInScript.add(p));
      s.speakingCharacters.forEach((p) => uniqueCharsInScript.add(p));
    });

    return {
      totalScenes: scenes.length,
      scenesWithDialogue,
      scenesWithoutDialogue: scenes.length - scenesWithDialogue,
      totalDialogues,
      uniqueCharacters: uniqueCharsInScript.size,
      characters: charStats,
      locations,
      validations,
    };
  }, [editorContent, characters]);

  const roleLabel = { main: 'Главный', secondary: 'Второстеп.', adult: 'Взрослый' };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fade-in overflow-y-auto">
      <h2 className="text-xl font-serif font-bold text-foreground">Статистика</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Всего сцен', value: stats.totalScenes },
          { label: 'С репликами', value: stats.scenesWithDialogue },
          { label: 'Без реплик', value: stats.scenesWithoutDialogue },
          { label: 'Всего реплик', value: stats.totalDialogues },
          { label: 'Персонажей', value: stats.uniqueCharacters },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold text-foreground mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Characters table */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users size={16} />
          Персонажи
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-2 text-muted-foreground font-medium">Персонаж</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Роль</th>
                <th className="text-center p-2 text-muted-foreground font-medium">Реплик</th>
                <th className="text-center p-2 text-muted-foreground font-medium">Сцен</th>
                <th className="text-center p-2 text-muted-foreground font-medium">Без реплик</th>
                <th className="text-center p-2 text-muted-foreground font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {stats.characters.map((c, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="p-2 text-foreground font-medium">{c.name}</td>
                  <td className="p-2 text-muted-foreground">{roleLabel[c.roleType]}</td>
                  <td className="p-2 text-center">{c.totalDialogues}</td>
                  <td className="p-2 text-center">{c.scenesWithParticipation}</td>
                  <td className="p-2 text-center">{c.scenesWithoutDialogue}</td>
                  <td className="p-2 text-center">
                    {c.status === 'ok' ? (
                      <CheckCircle2 size={14} className="text-success inline" />
                    ) : (
                      <span className="text-primary text-[10px]">{c.warnings.join(', ')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {stats.characters.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Добавьте персонажей во вкладке «Синопсис»
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Locations */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin size={16} />
          Локации
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {stats.locations.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Нет сцен в редакторе</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-2 text-muted-foreground font-medium">Локация</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Сцен</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {stats.locations.map((l, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="p-2 text-foreground">{l.name}</td>
                    <td className="p-2 text-center">{l.sceneCount}</td>
                    <td className="p-2 text-center">
                      {l.isExpensive ? (
                        <span className="text-primary text-[10px]">⚠ Дорогая</span>
                      ) : (
                        <CheckCircle2 size={14} className="text-success inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Validations */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle size={16} />
          Валидация правил
        </div>
        <div className="space-y-1.5">
          {stats.validations.length === 0 ? (
            <div className="flex items-center gap-2 text-success text-xs p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 size={16} />
              Все правила соблюдены
            </div>
          ) : (
            stats.validations.map((v, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 text-xs p-2.5 rounded-lg border',
                  v.type === 'error'
                    ? 'text-destructive bg-destructive/10 border-destructive/20'
                    : 'text-primary bg-primary/10 border-primary/20'
                )}
              >
                {v.type === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                <span>{v.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
