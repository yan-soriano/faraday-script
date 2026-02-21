export type RoleType = 'main' | 'secondary' | 'adult';

export interface Character {
  id: string;
  name: string;
  age: number;
  traits: string;
  roleType: RoleType;
  note?: string;
}

export interface ParsedScene {
  index: number;
  heading: string;
  participants: string[];
  actionText: string;
  hasDialogue: boolean;
  dialogueCount: number;
  speakingCharacters: string[];
}

export interface ValidationItem {
  type: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface CharacterStats {
  name: string;
  roleType: RoleType;
  totalDialogues: number;
  scenesWithParticipation: number;
  scenesWithoutDialogue: number;
  status: 'ok' | 'warning' | 'error';
  warnings: string[];
}

export interface LocationStats {
  name: string;
  sceneCount: number;
  isExpensive: boolean;
}

export interface ProjectStats {
  totalScenes: number;
  scenesWithDialogue: number;
  scenesWithoutDialogue: number;
  totalDialogues: number;
  uniqueCharacters: number;
  characters: CharacterStats[];
  locations: LocationStats[];
  validations: ValidationItem[];
}

export type TabType = 'synopsis' | 'script' | 'statistics';
