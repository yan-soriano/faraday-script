import { supabase } from '@/integrations/supabase/client';
import { applyAutoFormat, splitIntoSceneBlocks } from '@/lib/scene-sanitizer';

// Use untyped client to bypass empty auto-generated Database types
// (tables exist in user's own Supabase, not in Lovable Cloud)
const db = supabase as any;

export interface SceneForList {
  id: string;
  project_id: string;
  scene_number: number;
  header: string;
  participants: string;
  description: string;
  full_scene_text: string;
}

/** Get or create a project for the current user. Returns project id. */
export async function getOrCreateProject(
  userId: string,
  title: string,
  synopsis: string
): Promise<string> {
  const { data: existing } = await db
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from('projects')
      .update({ title, synopsis, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error } = await db
    .from('projects')
    .insert({ user_id: userId, title: title || '', synopsis: synopsis || '' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  if (!created?.id) throw new Error('Failed to create project');
  return created.id;
}

/** Parse outline text into scene blocks and save to Supabase. Returns saved scenes. */
export async function saveOutlineToSupabase(
  projectId: string,
  rawOutlineText: string
): Promise<SceneForList[]> {
  const cleaned = applyAutoFormat(rawOutlineText);
  const blocks = splitIntoSceneBlocks(cleaned);

  await db.from('scenes').delete().eq('project_id', projectId);

  const inserts = blocks.map((b, i) => ({
    project_id: projectId,
    scene_number: i + 1,
    header: b.header,
    participants: b.participants,
    description: b.description,
    full_scene_text: b.fullSceneText,
  }));

  if (inserts.length === 0) return [];

  const { data, error } = await db
    .from('scenes')
    .insert(inserts)
    .select();

  if (error) throw new Error(error.message);
  return (data || []) as SceneForList[];
}

/** Fetch all scenes for a project. */
export async function getScenesByProjectId(projectId: string): Promise<SceneForList[]> {
  const { data, error } = await db
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_number', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as SceneForList[];
}

/** Update a single scene's full_scene_text (e.g. after dialogue generation). */
export async function updateSceneFullText(
  projectId: string,
  sceneNumber: number,
  fullSceneText: string
): Promise<void> {
  const { error } = await db
    .from('scenes')
    .update({
      full_scene_text: fullSceneText,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('scene_number', sceneNumber);

  if (error) throw new Error(error.message);
}
