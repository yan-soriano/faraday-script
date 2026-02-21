import { useState } from 'react';
import { Sparkles, MessageSquare, Send, Wand2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/useProjectStore';
import { canGenerate } from '@/lib/validation';
import type { ParsedScene } from '@/types/screenplay';
import { cn } from '@/lib/utils';

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

  const isReady = canGenerate(title, synopsis, characters);
  const hasOutline = scenes.length > 0;

  const disabledReason = !isReady
    ? 'Заполните синопсис и персонажей на вкладке «Синопсис»'
    : undefined;

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/30">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <span className="text-xs font-semibold text-foreground">AI Ассистент</span>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center pt-8 space-y-2">
            <Wand2 size={24} className="mx-auto opacity-30" />
            <p>AI готов помочь с вашим сценарием</p>
            {!isReady && (
              <p className="text-primary/80 text-[10px]">
                Сначала заполните синопсис
              </p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'text-xs p-2 rounded-lg max-w-[90%] animate-fade-in',
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
        {/* Generation buttons */}
        <div className="space-y-1.5">
          <Button
            className="w-full justify-start gap-2 text-xs h-9"
            variant="outline"
            disabled={!isReady}
            title={disabledReason}
            onClick={() => {
              setMessages((m) => [...m, { role: 'ai', text: '⏳ Для генерации подключите Cloud (нажмите ниже)...' }]);
            }}
          >
            <BookOpen size={14} />
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
            disabled={!isReady || !hasOutline}
            title={!hasOutline ? 'Сначала создайте поэпизодник' : disabledReason}
            onClick={() => {
              setMessages((m) => [...m, { role: 'ai', text: '⏳ Для генерации диалогов подключите Cloud...' }]);
            }}
          >
            <MessageSquare size={14} />
            Создать диалог
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
            disabled={!chatInput.trim()}
            onClick={() => {
              if (!chatInput.trim()) return;
              setMessages((m) => [
                ...m,
                { role: 'user', text: chatInput },
                { role: 'ai', text: 'Подключите Cloud для AI чата' },
              ]);
              setChatInput('');
            }}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
