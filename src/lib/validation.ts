import type { Character, ParsedScene, ValidationItem } from '@/types/screenplay';
import { extractLocations, isExpensiveLocation } from './screenplay-parser';

export function validateSynopsis(
  title: string,
  synopsis: string,
  characters: Character[]
): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (!title.trim()) items.push({ type: 'error', message: 'Название не заполнено', field: 'title' });
  if (!synopsis.trim()) items.push({ type: 'error', message: 'Синопсис не заполнен', field: 'synopsis' });
  if (synopsis.length > 0 && synopsis.length < 200)
    items.push({ type: 'warning', message: 'Синопсис рекомендуется >= 200 символов', field: 'synopsis' });

  const mainKids = characters.filter((c) => c.roleType === 'main');
  const adults = characters.filter((c) => c.roleType === 'adult');

  if (mainKids.length !== 8)
    items.push({ type: 'error', message: `Главных детей должно быть 8 (сейчас ${mainKids.length})` });

  for (const k of mainKids) {
    if (k.age < 7 || k.age > 14)
      items.push({ type: 'error', message: `${k.name}: возраст должен быть 7–14 (сейчас ${k.age})` });
  }

  if (adults.length > 4)
    items.push({ type: 'error', message: `Взрослых максимум 4 (сейчас ${adults.length})` });

  if (characters.length === 0)
    items.push({ type: 'error', message: 'Добавьте хотя бы одного персонажа' });

  return items;
}

export function canGenerate(title: string, synopsis: string, characters: Character[]): boolean {
  const v = validateSynopsis(title, synopsis, characters);
  return !v.some((i) => i.type === 'error');
}

export function validateScript(scenes: ParsedScene[], characters: Character[]): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (scenes.length < 40) items.push({ type: 'warning', message: `Сцен меньше 40 (${scenes.length})` });
  if (scenes.length > 45) items.push({ type: 'warning', message: `Сцен больше 45 (${scenes.length})` });

  // Check character participation
  const mainKids = characters.filter((c) => c.roleType === 'main');
  for (const kid of mainKids) {
    const upper = kid.name.toUpperCase();
    const sceneCount = scenes.filter(
      (s) => s.participants.some((p) => p.toUpperCase() === upper) || s.speakingCharacters.includes(upper)
    ).length;
    if (sceneCount < 19) items.push({ type: 'warning', message: `${kid.name} (main): участие в ${sceneCount} сценах (рекомендуется 19–21)` });
    if (sceneCount > 21) items.push({ type: 'warning', message: `${kid.name} (main): участие в ${sceneCount} сценах (рекомендуется 19–21)` });
  }

  const secondaries = characters.filter((c) => c.roleType === 'secondary');
  for (const sec of secondaries) {
    const upper = sec.name.toUpperCase();
    const sceneCount = scenes.filter(
      (s) => s.participants.some((p) => p.toUpperCase() === upper) || s.speakingCharacters.includes(upper)
    ).length;
    if (sceneCount >= 10) items.push({ type: 'warning', message: `${sec.name} (secondary): участие в ${sceneCount} сценах (макс 10)` });
  }

  const adultChars = characters.filter((c) => c.roleType === 'adult');
  for (const ad of adultChars) {
    const upper = ad.name.toUpperCase();
    const sceneCount = scenes.filter(
      (s) => s.participants.some((p) => p.toUpperCase() === upper) || s.speakingCharacters.includes(upper)
    ).length;
    if (sceneCount > 20) items.push({ type: 'warning', message: `${ad.name} (adult): участие в ${sceneCount} сценах (макс 20)` });
  }

  // Location checks
  const locations = extractLocations(scenes);
  if (locations.length > 4) items.push({ type: 'warning', message: `Локаций больше 4 (${locations.length})` });

  for (const loc of locations) {
    if (loc.isExpensive) items.push({ type: 'warning', message: `Дорогая локация: "${loc.name}" — замените на двор/школа/дом` });
  }

  return items;
}
