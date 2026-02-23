-- Projects: one per screenplay (title, synopsis, etc. can live in app store; we use this for scene storage)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  synopsis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Scenes: each scene from episode outline, one row per scene
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_number int not null,
  header text not null,
  participants text not null default '',
  description text not null default '',
  full_scene_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, scene_number)
);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_scenes_project_id on public.scenes(project_id);

alter table public.projects enable row level security;
alter table public.scenes enable row level security;

create policy "Users can manage own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage scenes of own projects"
  on public.scenes for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = scenes.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = scenes.project_id and p.user_id = auth.uid()
    )
  );
