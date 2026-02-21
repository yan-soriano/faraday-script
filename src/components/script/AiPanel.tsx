import { useState, useRef } from 'react';
import { Sparkles, MessageSquare, Send, Wand2, BookOpen, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/useProjectStore';
import { canGenerate } from '@/lib/validation';
import { streamGeneration } from '@/lib/ai-stream';
import type { ParsedScene } from '@/types/screenplay';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  scenes: ParsedScene[];
  selectedScene: number | null;
  onSelectScene: (i: number) => void;
}

export default function AiPanel({ scenes, selectedScene, onSelectScene }: Props) {
  const { title, synopsis, characters } = useProjectStore();
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

  const insertTextToEditor = (text: string) => {
    const editor = (window as any).__kscriptEditor;
    if (editor) {
      editor.commands.setContent(text);
    }
  };

  const appendTextToEditor = (existingText: string, newChunk: string) => {
    const editor = (window as any).__kscriptEditor;
    if (editor) {
      // Build complete text and set it
      return existingText + newChunk;
    }
    return existingText + newChunk;
  };

  const handleGenerateOutline = async () => {
    if (!isReady || isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Генерация поэпизодника...');
    setMessages((m) => [...m, { role: 'ai', text: '⏳ Генерирую поэпизодник (40–45 сцен)...' }]);

    let fullText = '';
    const editor = (window as any).__kscriptEditor;

    await streamGeneration({
      body: { type: 'outline', title, synopsis, characters },
      onDelta: (chunk) => {
        fullText += chunk;
        if (editor) {
          editor.commands.setContent(`<p>${fullText.replace(/\n/g, '</p><p>')}</p>`);
        }
      },
      onDone: () => {
        setIsGenerating(false);
        setGenerationProgress('');
        setMessages((m) => [...m, { role: 'ai', text: '✅ Поэпизодник создан!' }]);
        toast({ title: 'Поэпизодник создан', description: `${fullText.split(/ИНТ\.|НАТ\./i).length - 1} сцен` });
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationProgress('');
        setMessages((m) => [...m, { role: 'ai', text: `❌ Ошибка: ${error}` }]);
        toast({ title: 'Ошибка генерации', description: error, variant: 'destructive' });
      },
    });
  };

  const handleGenerateDialogue = async () => {
    if (!isReady || !hasOutline || isGenerating) return;

    if (dialogueMode === 'selected') {
      if (selectedScene === null) {
        toast({ title: 'Выберите сцену', description: 'Укажите сцену в списке или выпадающем меню', variant: 'destructive' });
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
          title,
          synopsis,
          characters,
          scene: {
            heading: scene.heading,
            participants: scene.participants.join(', '),
            action: scene.actionText,
          },
        },
        onDelta: (chunk) => {
          dialogueText += chunk;
          setGenerationProgress(`Диалог для сцены ${selectedScene}... (${dialogueText.length} символов)`);
        },
        onDone: () => {
          // Insert dialogue into editor after the scene
          const editor = (window as any).__kscriptEditor;
          if (editor) {
            const currentContent = editor.getText();
            const lines = currentContent.split('\n');
            let insertPos = -1;
            let sceneCount = 0;

            for (let i = 0; i < lines.length; i++) {
              if (/^(ИНТ\.|НАТ\.)/i.test(lines[i].trim())) {
                sceneCount++;
                if (sceneCount === selectedScene) {
                  // Find end of this scene's action (before next heading or end)
                  let j = i + 1;
                  while (j < lines.length && !/^(ИНТ\.|НАТ\.)/i.test(lines[j].trim())) j++;
                  insertPos = j;
                  break;
                }
              }
            }

            if (insertPos >= 0) {
              lines.splice(insertPos, 0, '', dialogueText);
              const newContent = lines.join('\n');
              editor.commands.setContent(`<p>${newContent.replace(/\n/g, '</p><p>')}</p>`);
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
      // Generate for all scenes sequentially
      setIsGenerating(true);

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        setGenerationProgress(`Сцена ${i + 1}/${scenes.length}...`);
        setMessages((m) => [...m, { role: 'ai', text: `⏳ Диалог: сцена ${i + 1}/${scenes.length}` }]);

        let dialogueText = '';

        await new Promise<void>((resolve) => {
          streamGeneration({
            body: {
              type: 'dialogue',
              title,
              synopsis,
              characters,
              scene: {
                heading: scene.heading,
                participants: scene.participants.join(', '),
                action: scene.actionText,
              },
            },
            onDelta: (chunk) => { dialogueText += chunk; },
            onDone: () => {
              // Insert into editor
              const editor = (window as any).__kscriptEditor;
              if (editor) {
                const currentContent = editor.getText();
                const lines = currentContent.split('\n');
                let insertPos = -1;
                let sceneCount = 0;

                for (let j = 0; j < lines.length; j++) {
                  if (/^(ИНТ\.|НАТ\.)/i.test(lines[j].trim())) {
                    sceneCount++;
                    if (sceneCount === scene.index) {
                      let k = j + 1;
                      while (k < lines.length && !/^(ИНТ\.|НАТ\.)/i.test(lines[k].trim())) k++;
                      insertPos = k;
                      break;
                    }
                  }
                }

                if (insertPos >= 0) {
                  lines.splice(insertPos, 0, '', dialogueText);
                  const newContent = lines.join('\n');
                  editor.commands.setContent(`<p>${newContent.replace(/\n/g, '</p><p>')}</p>`);
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
      setMessages((m) => [...m, { role: 'ai', text: '✅ Все диалоги созданы!' }]);
      toast({ title: 'Диалоги созданы', description: `Для ${scenes.length} сцен` });
    }
  };

  const handleGenerateLogline = async () => {
    if (!isReady || isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Генерация логлайна...');

    let fullText = '';

    await streamGeneration({
      body: { type: 'logline', title, synopsis },
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
                  <SelectItem key={s.index} value={s.index.toString()}>
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
            onClick={() => {
              if (!chatInput.trim()) return;
              const userMessage = chatInput.trim();
              setMessages((m) => [...m, { role: 'user', text: userMessage }]);
              setChatInput('');
              let response = '';
              setIsGenerating(true);
              streamGeneration({
                body: {
                  type: 'chat',
                  message: userMessage,
                  title: title || '',
                  synopsis: synopsis || '',
                  characters,
                  scenes,
                  selectedSceneIndex: selectedScene,
                },
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
            }}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
