import { useState } from 'react';
import { Sparkles, MessageSquare, Send, Wand2, BookOpen, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/useProjectStore';
import { canGenerate } from '@/lib/validation';
import { streamGeneration } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import {
  getOrCreateProject,
  saveOutlineToSupabase,
  updateSceneFullText,
} from '@/lib/scenes-api';
import { applyAutoFormat } from '@/lib/scene-sanitizer';
import type { SceneForAi } from './ScriptTab';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  scenes: SceneForAi[];
  selectedScene: number | null;
  onSelectScene: (i: number) => void;
  projectId: string | null;
  onScenesSaved?: () => void;
}

function useProjectPayload(scenes: SceneForAi[], selectedScene: number | null) {
  const { title, synopsis, characters } = useProjectStore();
  const scenesForPayload = scenes.map((s) => ({
    index: s.index,
    heading: s.heading,
    participants: s.participants ? s.participants.split(',').map((p) => p.trim()) : [],
    actionText: s.actionText,
  }));
  return {
    title,
    synopsis,
    characters,
    scenes: scenesForPayload,
    selectedSceneIndex: selectedScene,
  };
}

export default function AiPanel({
  scenes,
  selectedScene,
  onSelectScene,
  projectId,
  onScenesSaved,
}: Props) {
  const { title, synopsis, characters, setProjectId } = useProjectStore();
  const payload = useProjectPayload(scenes, selectedScene);
  const [chatInput, setChatInput] = useState('');
  const [dialogueMode, setDialogueMode] = useState<'selected' | 'all'>('selected');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const { toast } = useToast();

  const isReady = canGenerate(title, synopsis, characters);
  const hasOutline = scenes.length > 0;

  const disabledReason = !isReady
    ? 'Заполните синопсис и персонажей на вкладке «Синопсис»'
    : undefined;

  // ─── Chat (free-form, never generates outline) ───
  const handleChat = async () => {
    if (!chatInput.trim() || isGenerating) return;
    const userMessage = chatInput.trim();
    setMessages((m) => [...m, { role: 'user', text: userMessage }]);
    setChatInput('');
    let response = '';
    setIsGenerating(true);

    await streamGeneration({
      body: { type: 'chat', message: userMessage, ...payload },
      onDelta: (chunk) => {
        response += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, text: response } : m);
          }
          return [...prev, { role: 'ai', text: response }];
        });
      },
      onDone: () => setIsGenerating(false),
      onError: (err) => {
        setIsGenerating(false);
        setMessages((m) => [...m, { role: 'ai', text: `❌ ${err}` }]);
      },
    });
  };

  // ─── Outline: stream then clean, save to Supabase (each scene separately) ───
  const handleGenerateOutline = async () => {
    if (!isReady || isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Генерация поэпизодника...');
    setMessages((m) => [...m, { role: 'ai', text: '⏳ Генерирую поэпизодник...' }]);

    let fullText = '';
    const editor = (window as any).__kscriptEditor;

    await streamGeneration({
      body: { type: 'outline', ...payload },
      onDelta: (chunk) => {
        fullText += chunk;
        if (editor) {
          editor.commands.setContent(`<p>${fullText.replace(/\n/g, '</p><p>')}</p>`);
        }
      },
      onDone: async () => {
        const cleaned = applyAutoFormat(fullText);
        if (editor) {
          editor.commands.setContent(`<p>${cleaned.replace(/\n/g, '</p><p>')}</p>`);
        }
        const sceneCount = (cleaned.match(/^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/mgi) || []).length;

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const pid = await getOrCreateProject(session.user.id, title, synopsis);
            await saveOutlineToSupabase(pid, cleaned);
            setProjectId(pid);
            onScenesSaved?.();
          }
        } catch (e) {
          console.error('Save outline to Supabase:', e);
          toast({
            title: 'Поэпизодник создан',
            description: 'Сохранение в облако не выполнено (войдите в аккаунт).',
            variant: 'destructive',
          });
        }

        setIsGenerating(false);
        setGenerationProgress('');
        setMessages((m) => [...m, { role: 'ai', text: '✅ Поэпизодник создан!' }]);
        toast({
          title: 'Поэпизодник создан',
          description: sceneCount ? `${sceneCount} сцен` : 'Готово',
        });
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationProgress('');
        setMessages((m) => [...m, { role: 'ai', text: `❌ Ошибка: ${error}` }]);
        toast({ title: 'Ошибка генерации', description: error, variant: 'destructive' });
      },
    });
  };

  // ─── Dialogue: only selected scene context; replace scene block in-place; update Supabase ───
  const replaceSceneBlockInEditor = (
    editor: { getText: () => string; commands: { setContent: (html: string) => void } },
    sceneIndex: number,
    newSceneText: string
  ) => {
    const currentContent = editor.getText();
    const lines = currentContent.split('\n');
    let sceneStart = -1;
    let sceneEnd = lines.length;
    let sceneCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (/^(ИНТ\.|ЭКСТ\.|НАТ\.)/i.test(lines[i].trim())) {
        sceneCount++;
        if (sceneCount === sceneIndex) {
          sceneStart = i;
        } else if (sceneCount === sceneIndex + 1 && sceneStart >= 0) {
          sceneEnd = i;
          break;
        }
      }
    }

    if (sceneStart < 0) return;
    const before = lines.slice(0, sceneStart).join('\n');
    const after = lines.slice(sceneEnd).join('\n');
    const newContent = [before, newSceneText.trim(), after].filter(Boolean).join('\n\n');
    editor.commands.setContent(`<p>${newContent.replace(/\n/g, '</p><p>')}</p>`);
  };

  const handleGenerateDialogue = async () => {
    if (!isReady || !hasOutline || isGenerating) return;

    if (dialogueMode === 'selected') {
      if (selectedScene === null) {
        toast({
          title: 'Выберите сцену',
          description: 'Укажите сцену в списке или выпадающем меню',
          variant: 'destructive',
        });
        return;
      }
      const scene = scenes.find((s) => s.index === selectedScene);
      if (!scene) return;

      setIsGenerating(true);
      setGenerationProgress(`Диалог для сцены ${selectedScene}...`);
      setMessages((m) => [...m, { role: 'ai', text: `⏳ Генерирую диалог для сцены ${selectedScene}...` }]);

      let dialogueText = '';

      await streamGeneration({
        body: {
          type: 'dialogue',
          ...payload,
          scene: {
            heading: scene.heading,
            participants: scene.participants,
            action: scene.actionText,
          },
        },
        onDelta: (chunk) => {
          dialogueText += chunk;
          setGenerationProgress(`Диалог для сцены ${selectedScene}... (${dialogueText.length} символов)`);
        },
        onDone: async () => {
          const cleanedDialogue = applyAutoFormat(dialogueText);
          const editor = (window as any).__kscriptEditor;
          if (editor) {
            replaceSceneBlockInEditor(editor, selectedScene, cleanedDialogue);
          }
          if (projectId) {
            try {
              await updateSceneFullText(projectId, selectedScene, cleanedDialogue);
              onScenesSaved?.();
            } catch (e) {
              console.error('Update scene in Supabase:', e);
            }
          }
          setIsGenerating(false);
          setGenerationProgress('');
          setMessages((m) => [...m, { role: 'ai', text: `✅ Диалог для сцены ${selectedScene} создан!` }]);
        },
        onError: (error) => {
          setIsGenerating(false);
          setGenerationProgress('');
          setMessages((m) => [...m, { role: 'ai', text: `❌ Ошибка: ${error}` }]);
          toast({ title: 'Ошибка', description: error, variant: 'destructive' });
        },
      });
    } else {
      setIsGenerating(true);
      const editor = (window as any).__kscriptEditor;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        setGenerationProgress(`Сцена ${i + 1}/${scenes.length}...`);
        setMessages((m) => [...m, { role: 'ai', text: `⏳ Диалог: сцена ${i + 1}/${scenes.length}` }]);

        let dialogueText = '';

        await new Promise<void>((resolve) => {
          streamGeneration({
            body: {
              type: 'dialogue',
              ...payload,
              scene: {
                heading: scene.heading,
                participants: scene.participants,
                action: scene.actionText,
              },
            },
            onDelta: (chunk) => {
              dialogueText += chunk;
            },
            onDone: async () => {
              const cleaned = applyAutoFormat(dialogueText);
              if (editor) replaceSceneBlockInEditor(editor, scene.index, cleaned);
              if (projectId) {
                try {
                  await updateSceneFullText(projectId, scene.index, cleaned);
                } catch {
                  // ignore per-scene update errors
                }
              }
              resolve();
            },
            onError: (error) => {
              setMessages((m) => [...m, { role: 'ai', text: `❌ Сцена ${i + 1}: ${error}` }]);
              resolve();
            },
          });
        });
      }

      setIsGenerating(false);
      setGenerationProgress('');
      onScenesSaved?.();
      setMessages((m) => [...m, { role: 'ai', text: '✅ Все диалоги созданы!' }]);
      toast({ title: 'Диалоги созданы', description: `Для ${scenes.length} сцен` });
    }
  };

  // ─── Logline ───
  const handleGenerateLogline = async () => {
    if (!isReady || isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Генерация логлайна...');

    let fullText = '';

    await streamGeneration({
      body: { type: 'logline', ...payload },
      onDelta: (chunk) => {
        fullText += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && last.text.startsWith('📝')) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, text: `📝 ${fullText}` } : m);
          }
          return [...prev, { role: 'ai', text: `📝 ${fullText}` }];
        });
      },
      onDone: () => {
        setIsGenerating(false);
        setGenerationProgress('');
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationProgress('');
        setMessages((m) => [...m, { role: 'ai', text: `❌ ${error}` }]);
        toast({ title: 'Ошибка', description: error, variant: 'destructive' });
      },
    });
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/30">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <span className="text-xs font-semibold text-foreground">AI Ассистент</span>
        {isGenerating && (
          <span className="text-[10px] text-primary animate-pulse-gold ml-auto truncate max-w-32">
            {generationProgress}
          </span>
        )}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center pt-8 space-y-2">
            <Wand2 size={24} className="mx-auto opacity-30" />
            <p>AI готов помочь с вашим сценарием</p>
            {!isReady && (
              <p className="text-primary/80 text-[10px]">Сначала заполните синопсис</p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'text-xs p-2 rounded-lg max-w-[90%] animate-fade-in whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-primary/15 text-foreground ml-auto'
                : 'bg-secondary text-foreground'
            )}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="p-3 space-y-2 border-t border-border">
        <div className="space-y-1.5">
          <Button
            className="w-full justify-start gap-2 text-xs h-9"
            variant="outline"
            disabled={!isReady || isGenerating}
            title={disabledReason}
            onClick={handleGenerateOutline}
          >
            {isGenerating && generationProgress.includes('поэпизодник') ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <BookOpen size={14} />
            )}
            Создать поэпизодник
          </Button>

          {/* Dialogue mode */}
          <div className="flex gap-1.5">
            <Select value={dialogueMode} onValueChange={(v: 'selected' | 'all') => setDialogueMode(v)}>
              <SelectTrigger className="h-8 text-[11px] bg-input flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">Для выбранной сцены</SelectItem>
                <SelectItem value="all">Для всех сцен</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dialogueMode === 'selected' && hasOutline && (
            <Select
              value={selectedScene?.toString() || ''}
              onValueChange={(v) => onSelectScene(parseInt(v))}
            >
              <SelectTrigger className="h-8 text-[11px] bg-input">
                <SelectValue placeholder="Выберите сцену" />
              </SelectTrigger>
              <SelectContent>
                {scenes.map((s) => (
                  <SelectItem key={s.index} value={String(s.index)}>
                    {s.index}. {s.heading.slice(0, 35)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            className="w-full justify-start gap-2 text-xs h-9"
            variant="outline"
            disabled={!isReady || !hasOutline || isGenerating}
            title={!hasOutline ? 'Сначала создайте поэпизодник' : disabledReason}
            onClick={handleGenerateDialogue}
          >
            {isGenerating && generationProgress.includes('Диалог') ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <MessageSquare size={14} />
            )}
            Создать диалог
          </Button>

          <Button
            className="w-full justify-start gap-2 text-xs h-9"
            variant="outline"
            disabled={!isReady || isGenerating}
            title={disabledReason}
            onClick={handleGenerateLogline}
          >
            {isGenerating && generationProgress.includes('логлайн') ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            Создать логлайн
          </Button>
        </div>

        {/* Chat input */}
        <div className="flex gap-1.5">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Спросите AI..."
            rows={1}
            className="bg-input text-xs min-h-[32px] max-h-20 resize-none"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            disabled={!chatInput.trim() || isGenerating}
            onClick={handleChat}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
