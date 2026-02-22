import { Node, mergeAttributes } from '@tiptap/core';

export type ScreenplayNodeType =
  | 'sceneHeading'
  | 'sceneParticipants'
  | 'action'
  | 'characterCue'
  | 'dialogue'
  | 'parenthetical'
  | 'transition';

const HEADING_RE = /^(ИНТ\.|НАТ\.)\s*.+/i;
const ALLCAPS_RE = /^[А-ЯЁA-Z\s]{2,}$/;
const TRANSITION_RE = /^[А-ЯЁA-Z\s]+:$/;

/** Detect screenplay node type from text content */
export function detectNodeType(
  text: string,
  prevType?: ScreenplayNodeType
): ScreenplayNodeType | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (HEADING_RE.test(trimmed)) return 'sceneHeading';

  if (
    prevType === 'sceneHeading' &&
    ALLCAPS_RE.test(trimmed) &&
    trimmed.includes(',')
  ) {
    return 'sceneParticipants';
  }

  if (TRANSITION_RE.test(trimmed) && trimmed.length < 40) return 'transition';

  if (
    ALLCAPS_RE.test(trimmed) &&
    !trimmed.includes(',') &&
    trimmed.length < 40
  ) {
    return 'characterCue';
  }

  if (
    prevType === 'characterCue' &&
    trimmed.startsWith('(') &&
    trimmed.endsWith(')')
  ) {
    return 'parenthetical';
  }

  return null;
}

/** Map of next node type on Enter key */
export const ENTER_NEXT: Partial<Record<ScreenplayNodeType, ScreenplayNodeType>> = {
  sceneHeading: 'sceneParticipants',
  sceneParticipants: 'action',
  characterCue: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
};

/** Map of next node type on Tab key */
export const TAB_NEXT: Partial<Record<ScreenplayNodeType, ScreenplayNodeType>> = {
  action: 'characterCue',
  characterCue: 'parenthetical',
};

function createScreenplayNode(
  name: ScreenplayNodeType,
  tag: string,
  cssClass: string
) {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    defining: true,

    parseHTML() {
      return [{ tag, attrs: { 'data-type': name } }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        tag,
        mergeAttributes(HTMLAttributes, {
          'data-type': name,
          class: `sp-${cssClass}`,
        }),
        0,
      ];
    },

    addCommands() {
      return {
        [`set${name.charAt(0).toUpperCase() + name.slice(1)}`]:
          () =>
          ({ commands }: any) => {
            return commands.setNode(name);
          },
      } as any;
    },
  });
}

export const SceneHeading = createScreenplayNode('sceneHeading', 'div', 'scene-heading');
export const SceneParticipants = createScreenplayNode('sceneParticipants', 'div', 'scene-participants');
export const Action = createScreenplayNode('action', 'div', 'action');
export const CharacterCue = createScreenplayNode('characterCue', 'div', 'character-cue');
export const Dialogue = createScreenplayNode('dialogue', 'div', 'dialogue');
export const Parenthetical = createScreenplayNode('parenthetical', 'div', 'parenthetical');
export const Transition = createScreenplayNode('transition', 'div', 'transition');

export const allScreenplayNodes = [
  SceneHeading,
  SceneParticipants,
  Action,
  CharacterCue,
  Dialogue,
  Parenthetical,
  Transition,
];
