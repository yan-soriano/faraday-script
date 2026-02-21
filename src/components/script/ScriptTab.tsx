import { useState, useCallback } from 'react';
import SceneList from './SceneList';
import ScriptEditor from './ScriptEditor';
import AiPanel from './AiPanel';
import { parseScenes } from '@/lib/screenplay-parser';
import type { ParsedScene } from '@/types/screenplay';

export default function ScriptTab() {
  const [scenes, setScenes] = useState<ParsedScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  const handleContentChange = useCallback((text: string) => {
    const parsed = parseScenes(text);
    setScenes(parsed);
  }, []);

  return (
    <div className="flex h-full animate-fade-in">
      {/* Scene list */}
      <div className="w-48 border-r border-border shrink-0 bg-card/20">
        <SceneList
          scenes={scenes}
          selectedIndex={selectedScene}
          onSelect={setSelectedScene}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        <ScriptEditor onContentChange={handleContentChange} />
      </div>

      {/* AI Panel */}
      <div className="w-72 shrink-0">
        <AiPanel
          scenes={scenes}
          selectedScene={selectedScene}
          onSelectScene={setSelectedScene}
        />
      </div>
    </div>
  );
}
