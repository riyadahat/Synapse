-- ContextFlow schema. Run in Supabase SQL editor (or `supabase db push`).
-- Every team-owned table is protected by Row Level Security: access requires team membership.

create extension if not exists "pgcrypto";

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── tables ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role_title text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text unique,
  created_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  scheduled_at timestamptz not null default now(),
  agenda text,
  notes text,
  summary text,
  discussion_points jsonb not null default '[]'::jsonb,
  unresolved_questions jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attended boolean,  -- null = not recorded yet
  unique (meeting_id, user_id)
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete cascade,
  text text not null,
  rationale text,
  source text not null default 'manual' check (source in ('manual','ai_explicit','ai_inferred')),
  created_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','completed')),
  origin_meeting_id uuid references public.meetings(id) on delete set null,
  completion_outcome text,
  completed_at timestamptz,
  source text not null default 'manual' check (source in ('manual','ai_extracted')),
  owner_uncertain boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many-to-many: one task (one id, one history) can appear in many meetings.
create table public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  relation text not null default 'originated' check (relation in ('originated','carried_forward','discussed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (meeting_id, task_id)
);

create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created','updated','status_changed','reassigned','due_changed','carried_forward','completed','reopened','handover_transferred')),
  field text,
  old_value text,
  new_value text,
  meeting_id uuid references public.meetings(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete restrict,
  to_user uuid not null references public.profiles(id) on delete restrict,
  project text not null,
  reason text,
  notes text,
  brief jsonb,
  status text not null default 'pending' check (status in ('pending','acknowledged','declined')),
  acknowledged_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create table public.handover_tasks (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  previous_owner_id uuid references public.profiles(id) on delete set null,
  new_owner_id uuid references public.profiles(id) on delete set null,
  transferred boolean not null default false,
  transferred_at timestamptz,
  unique (handover_id, task_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  filename text,
  mime_type text,
  storage_path text,
  content text not null default '',
  char_count int generated always as (char_length(content)) stored,
  meeting_id uuid references public.meetings(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  unique (document_id, chunk_index)
);
-- Semantic search upgrade path: `create extension vector; alter table document_chunks add column embedding vector(1024);`

create table public.task_documents (
  task_id uuid not null references public.tasks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (task_id, document_id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────── indexes ─────────────────────────
create index on public.team_members (user_id);
create index on public.meetings (team_id, scheduled_at desc);
create index on public.meeting_participants (user_id);
create index on public.decisions (team_id, created_at desc);
create index on public.decisions (meeting_id);
create index on public.tasks (team_id, status);
create index on public.tasks (assignee_id, status);
create index on public.tasks (due_date) where status <> 'completed';
create index on public.meeting_tasks (task_id);
create index on public.task_history (task_id, created_at desc);
create index on public.handovers (team_id, status);
create index on public.document_chunks using gin (tsv);
create index on public.document_chunks (team_id);
create index on public.activity_logs (team_id, created_at desc);

-- ───────────────────────── triggers ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','teams','meetings','tasks','handovers','documents'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Create a profile row whenever someone signs up through Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role_title, is_seed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'role_title',
    coalesce((new.raw_user_meta_data->>'is_seed')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────── RLS helpers ─────────────────────────
create or replace function public.is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid())
$$;

create or replace function public.is_team_admin(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.shares_team_with(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() or exists (
    select 1 from public.team_members a join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = u)
$$;

-- Resolve team via a parent row (for tables that only carry a parent FK).
create or replace function public.team_of_meeting(m uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.meetings where id = m $$;
create or replace function public.team_of_task(t uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.tasks where id = t $$;
create or replace function public.team_of_handover(h uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.handovers where id = h $$;
create or replace function public.team_of_document(d uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.documents where id = d $$;

-- ───────────────────────── enable RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.decisions enable row level security;
alter table public.tasks enable row level security;
alter table public.meeting_tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.handovers enable row level security;
alter table public.handover_tasks enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.task_documents enable row level security;
alter table public.activity_logs enable row level security;

-- ───────────────────────── policies ─────────────────────────
-- profiles: see yourself and teammates; edit only yourself.
create policy profiles_select on public.profiles for select to authenticated using (public.shares_team_with(id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- teams: members read; any signed-in user may create a team they own; admins update/delete.
create policy teams_select on public.teams for select to authenticated using (public.is_team_member(id) or created_by = auth.uid());
create policy teams_insert on public.teams for insert to authenticated with check (created_by = auth.uid());
create policy teams_update on public.teams for update to authenticated using (public.is_team_admin(id));
create policy teams_delete on public.teams for delete to authenticated using (public.is_team_admin(id));

-- team_members: members read; admins manage; a team creator may add themselves as the first admin.
create policy tm_select on public.team_members for select to authenticated using (public.is_team_member(team_id));
create policy tm_insert on public.team_members for insert to authenticated with check (
  public.is_team_admin(team_id)
  or (user_id = auth.uid() and exists (select 1 from public.teams t where t.id = team_id and t.created_by = auth.uid()))
);
create policy tm_update on public.team_members for update to authenticated using (public.is_team_admin(team_id));
create policy tm_delete on public.team_members for delete to authenticated using (public.is_team_admin(team_id) or user_id = auth.uid());

-- Direct team_id tables.
do $$
declare t text;
begin
  foreach t in array array['meetings','decisions','tasks','handovers','documents','document_chunks','activity_logs'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_team_member(team_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_team_member(team_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_team_member(team_id))', t);
  end loop;
end $$;
-- Audit trail is append-only for clients.
drop policy activity_logs_update on public.activity_logs;
drop policy activity_logs_delete on public.activity_logs;

-- Child tables resolved through their parent's team.
create policy mp_all on public.meeting_participants for all to authenticated
  using (public.is_team_member(public.team_of_meeting(meeting_id))) with check (public.is_team_member(public.team_of_meeting(meeting_id)));
create policy mt_all on public.meeting_tasks for all to authenticated
  using (public.is_team_member(public.team_of_meeting(meeting_id))) with check (public.is_team_member(public.team_of_meeting(meeting_id)));
create policy th_select on public.task_history for select to authenticated using (public.is_team_member(public.team_of_task(task_id)));
create policy th_insert on public.task_history for insert to authenticated with check (public.is_team_member(public.team_of_task(task_id)));  -- append-only
create policy ht_all on public.handover_tasks for all to authenticated
  using (public.is_team_member(public.team_of_handover(handover_id))) with check (public.is_team_member(public.team_of_handover(handover_id)));
create policy td_all on public.task_documents for all to authenticated
  using (public.is_team_member(public.team_of_task(task_id))) with check (public.is_team_member(public.team_of_task(task_id)));

-- ───────────────────────── storage ─────────────────────────
-- Private bucket; objects are namespaced `<team_id>/<file>` and gated by team membership.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
create policy docs_storage_rw on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_team_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'documents' and public.is_team_member(((storage.foldername(name))[1])::uuid));