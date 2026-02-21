import type { ParsedScene } from '@/types/screenplay';

const HEADING_RE = /^(ИНТ\.|НАТ\.)\s*.+/i;
const ALLCAPS_RE = /^[А-ЯЁA-Z\s,]{2,}$/;

export function parseScenes(text: string): ParsedScene[] {
  const lines = text.split('\n').map((l) => l.trim());
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let lineAfterHeading = false;

  for (const line of lines) {
    if (!line) continue;

    if (HEADING_RE.test(line)) {
      if (current) scenes.push(current);
      current = {
        index: scenes.length + 1,
        heading: line,
        participants: [],
        actionText: '',
        hasDialogue: false,
        dialogueCount: 0,
        speakingCharacters: [],
      };
      lineAfterHeading = true;
      continue;
    }

    if (!current) continue;

    // Line right after heading with comma-separated uppercase names = participants
    if (lineAfterHeading && ALLCAPS_RE.test(line) && line.includes(',')) {
      current.participants = line.split(',').map((n) => n.trim());
      lineAfterHeading = false;
      continue;
    }
    lineAfterHeading = false;

    // Character cue detection (single uppercase name, no comma)
    if (ALLCAPS_RE.test(line) && !line.includes(',') && line.length < 40) {
      current.hasDialogue = true;
      current.dialogueCount++;
      const charName = line.trim();
      if (!current.speakingCharacters.includes(charName)) {
        current.speakingCharacters.push(charName);
      }
      continue;
    }

    // Everything else is action/dialogue text
    current.actionText += (current.actionText ? ' ' : '') + line;
  }

  if (current) scenes.push(current);
  return scenes;
}

const EXPENSIVE_KEYWORDS = [
  'тц', 'торговый центр', 'mall',
  'аэропорт', 'airport',
  'вокзал', 'концерт', 'concert',
  'стадион', 'stadium',
  'вертолёт', 'вертолет', 'helicopter',
  'самолёт', 'самолет', 'plane',
  'казино', 'casino',
  'фестиваль', 'митинг', 'массовка',
];

export function isExpensiveLocation(heading: string): boolean {
  const lower = heading.toLowerCase();
  return EXPENSIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function extractLocations(scenes: ParsedScene[]) {
  const map = new Map<string, { count: number; expensive: boolean }>();
  for (const s of scenes) {
    const loc = s.heading.replace(/^(ИНТ\.|НАТ\.)\s*/i, '').trim();
    const existing = map.get(loc);
    if (existing) {
      existing.count++;
    } else {
      map.set(loc, { count: 1, expensive: isExpensiveLocation(loc) });
    }
  }
  return Array.from(map.entries()).map(([name, v]) => ({
    name,
    sceneCount: v.count,
    isExpensive: v.expensive,
  }));
}
