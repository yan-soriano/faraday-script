/**
 * Strict screenplay output cleaning + auto-format per spec:
 * - Trim before first ИНТ./ЭКСТ./НАТ., remove meta after.
 * - Slugline: normalize " - " / " — " → " – " (en dash).
 * - Collapse excess blank lines (max 1 blank between blocks/scenes).
 */

const SCENE_HEADER_RE = /^(ИНТ\.|ЭКСТ\.|НАТ\.)\s+.+[\s–—-].+$/i;
const FIRST_SCENE_RE = /^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/mi;
const SLUGLINE_START_RE = /^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/i;
const EN_DASH = "–";

/** Forbidden phrases that indicate AI commentary (strip or reject) */
const FORBIDDEN_PHRASES = [
  /вот\s+(поэпизодник|сцены|диалог)/i,
  /рекомендую|предлагаю|советую/i,
  /можно\s+(добавить|улучшить)/i,
  /чеклист|checklist/i,
  /примечание|заметка|комментарий/i,
  /обратите\s+внимание/i,
  /важно\s*:/i,
  /^\s*[\d]+[.)]\s*$/m,
  /^\s*—+\s*$/m,
  /^\s*\.{3,}\s*$/m,
];

/**
 * Trim raw Gemini response to only screenplay content.
 * - Keeps content starting from first ИНТ./ЭКСТ./НАТ. line.
 * - Truncates after last valid scene block (heuristic: double newline + no scene header for rest).
 */
export function trimToScreenplayOnly(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(FIRST_SCENE_RE);
  if (!match || match.index == null) return trimmed;
  let start = match.index;
  let content = trimmed.slice(start);

  // Optional: cut at first line that looks like meta (e.g. "CHECKLIST", "Примечания")
  const metaPatterns = [
    /^\s*(CHECKLIST|ПРИМЕЧАНИЯ|РЕКОМЕНДАЦИИ|ИТОГО|ВЫВОДЫ)\s*$/im,
    /^\s*\[?\s*AI\s*(comment|note|commentary)\s*\]?/im,
  ];
  for (const re of metaPatterns) {
    const metaMatch = content.match(re);
    if (metaMatch && metaMatch.index != null) {
      content = content.slice(0, metaMatch.index).trim();
    }
  }

  return content;
}

/**
 * Validate a single scene header line (ИНТ./ЭКСТ. ЛОКАЦИЯ – ВРЕМЯ).
 */
export function isValidSceneHeader(line: string): boolean {
  return SCENE_HEADER_RE.test(line.trim());
}

/**
 * Check if text contains forbidden commentary; returns true if clean.
 */
export function hasNoForbiddenCommentary(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_PHRASES.some((re) => re.test(text) || re.test(lower));
}

/**
 * Sanitize a single scene block (header + participants + description) for storage.
 * Ensures no trailing commentary.
 */
export function sanitizeSceneBlock(block: string): string {
  const lines = block.split("\n").map((l) => l.trimEnd());
  const result: string[] = [];
  for (const line of lines) {
    if (line === "") {
      result.push("");
      continue;
    }
    if (FORBIDDEN_PHRASES.some((re) => re.test(line))) break;
    result.push(line);
  }
  return result.join("\n").trimEnd();
}

/**
 * Split full outline text into individual scene blocks (header + participants + description).
 * Expects format: ИНТ./ЭКСТ. ... \n PARTICIPANTS \n\n Description...
 */
export function splitIntoSceneBlocks(fullText: string): Array<{ header: string; participants: string; description: string; fullSceneText: string }> {
  const cleaned = trimToScreenplayOnly(fullText);
  const scenes: Array<{ header: string; participants: string; description: string; fullSceneText: string }> = [];
  const lines = cleaned.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (!/^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/i.test(line.trim())) {
      i++;
      continue;
    }

    const header = line.trim();
    i++;
    const participantsLine = i < lines.length ? lines[i].trim() : "";
    const participants =
      participantsLine && !/^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/i.test(participantsLine)
        ? participantsLine
        : "";
    i++; // move past participants line

    const descLines: string[] = [];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === "") {
        descLines.push("");
        i++;
        continue;
      }
      if (/^(ИНТ\.|ЭКСТ\.|НАТ\.)\s/i.test(next.trim())) break;
      descLines.push(next);
      i++;
    }

    const description = descLines.join("\n").trim();
    const fullSceneText = [header, participants, description].filter(Boolean).join("\n\n");
    scenes.push({ header, participants, description, fullSceneText });
  }

  return scenes;
}

/**
 * In sluglines (ИНТ./ЭКСТ./НАТ. ...), normalize " - " and " — " to en dash " – ".
 */
function normalizeSluglineDashes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (SLUGLINE_START_RE.test(line.trim())) {
        return line.replace(/\s+[-—]\s+/g, ` ${EN_DASH} `).trimEnd();
      }
      return line;
    })
    .join("\n");
}

/**
 * Collapse 3+ consecutive newlines to 2 (one blank line). Preserves intentional single blank.
 */
function normalizeBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trimEnd();
}

/**
 * Full auto-format: trim to screenplay, normalize slugline dashes, collapse excess blanks.
 * Call after Gemini response before saving or inserting into editor.
 */
export function applyAutoFormat(raw: string): string {
  const trimmed = trimToScreenplayOnly(raw);
  const dashes = normalizeSluglineDashes(trimmed);
  return normalizeBlankLines(dashes);
}
