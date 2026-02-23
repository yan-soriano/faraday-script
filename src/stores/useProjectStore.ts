import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, TabType } from '@/types/screenplay';

interface ProjectState {
  title: string;
  synopsis: string;
  characters: Character[];
  activeTab: TabType;
  editorContent: any | null;
  lastSaved: number | null;
  projectId: string | null;

  setTitle: (t: string) => void;
  setSynopsis: (s: string) => void;
  setActiveTab: (t: TabType) => void;
  setEditorContent: (c: any) => void;
  setProjectId: (id: string | null) => void;
  addCharacter: (c: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  markSaved: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      title: '',
      synopsis: '',
      characters: [],
      activeTab: 'synopsis',
      editorContent: null,
      lastSaved: null,
      projectId: null,

      setTitle: (title) => set({ title }),
      setSynopsis: (synopsis) => set({ synopsis }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setEditorContent: (editorContent) => set({ editorContent }),
      setProjectId: (projectId) => set({ projectId }),
      addCharacter: (c) => set((s) => ({ characters: [...s.characters, c] })),
      updateCharacter: (id, updates) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeCharacter: (id) =>
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
      markSaved: () => set({ lastSaved: Date.now() }),
    }),
    { name: 'kscript-project' }
  )
);
