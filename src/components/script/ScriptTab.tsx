import { useState, useCallback, useEffect } from 'react';
import SceneList from './SceneList';
import type { SceneListItem } from './SceneList';
import ScriptEditor from './ScriptEditor';
import AiPanel from './AiPanel';
import { parseScenes } from '@/lib/screenplay-parser';
import type { ParsedScene } from '@/types/screenplay';
import { useProjectStore } from '@/stores/useProjectStore';
import { getScenesByProjectId } from '@/lib/scenes-api';
import type { SceneForList } from '@/lib/scenes-api';

/** Unified scene shape for AiPanel (heading, participants, action/description). */
export interface SceneForAi {
  index: number;
  heading: string;
  participants: string;
  actionText: string;
}

function toSceneForAi(s: SceneForList): SceneForAi {
  return {
    index: s.scene_number,
    heading: s.header,
    participants: s.participants,
    actionText: s.description,
  };
}

function toSceneForAiFromParsed(s: ParsedScene): SceneForAi {
  return {
    index: s.index,
    heading: s.heading,
    participants: (s.participants || []).join(', '),
    actionText: s.actionText || '',
  };
}

export default function ScriptTab() {
  const { projectId } = useProjectStore();
  const [scenesFromDb, setScenesFromDb] = useState<SceneForList[] | null>(null);
  const [parsedScenes, setParsedScenes] = useState<ParsedScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  const handleContentChange = useCallback((text: string) => {
    setParsedScenes(parseScenes(text));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setScenesFromDb(null);
      return;
    }
    getScenesByProjectId(projectId)
      .then(setScenesFromDb)
      .catch(() => setScenesFromDb(null));
  }, [projectId]);

  const sceneListItems: SceneListItem[] =
    scenesFromDb && scenesFromDb.length > 0
      ? scenesFromDb.map((s) => ({
          index: s.scene_number,
          heading: s.header,
          descriptionPreview: s.description.slice(0, 200),
        }))
      : parsedScenes.map((s) => ({
          index: s.index,
          heading: s.heading,
          descriptionPreview: (s.actionText || '').slice(0, 200),
        }));

  const scenesForAi: SceneForAi[] =
    scenesFromDb && scenesFromDb.length > 0
      ? scenesFromDb.map(toSceneForAi)
      : parsedScenes.map(toSceneForAiFromParsed);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="w-48 border-r border-border shrink-0 bg-card/20">
        <SceneList
          scenes={sceneListItems}
          selectedIndex={selectedScene}
          onSelect={setSelectedScene}
        />
      </div>

      <div className="flex-1 min-w-0">
        <ScriptEditor onContentChange={handleContentChange} />
      </div>

      <div className="w-72 shrink-0">
        <AiPanel
          scenes={scenesForAi}
          selectedScene={selectedScene}
          onSelectScene={setSelectedScene}
          projectId={projectId}
          onScenesSaved={() => projectId && getScenesByProjectId(projectId).then(setScenesFromDb)}
        />
      </div>
    </div>
  );
}
