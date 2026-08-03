-- Sonda Note — initial schema (Month 1–2 MVP)
-- Postgres + Supabase Auth + Row-Level Security per workspace.
--
-- Isolation model: every row that holds meeting data carries workspace_id.
-- RLS policies check membership via workspace_members. The FastAPI backend
-- uses the service-role key and enforces workspace scope in application code
-- (see api/app/deps.py); the dashboard uses the anon key and relies on RLS.

create extension if not exists "uuid-ossp";
-- pgvector is Month 3 (embeddings). Enabled early so the extension exists
-- before the transcript_chunks table gains its embedding column.
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────
-- WORKSPACES
-- ─────────────────────────────────────────────────────────

create type workspace_industry as enum ('tech', 'business', 'real_estate', 'legal', 'other');

create table workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  industry    workspace_industry not null default 'tech',
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create type workspace_role as enum ('owner', 'admin', 'member');

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on workspace_members(user_id);

-- ─────────────────────────────────────────────────────────
-- MEETINGS
-- ─────────────────────────────────────────────────────────

-- uploading  → extension is still streaming chunks
-- queued     → all chunks received, waiting for the pipeline
-- processing → ffmpeg / ASR / cleaner running
-- ready      → transcript available
-- failed     → see error_message
create type meeting_status as enum ('uploading', 'queued', 'processing', 'ready', 'failed');

create table meetings (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  created_by     uuid not null references auth.users(id) on delete restrict,
  title          text not null default 'Untitled meeting',
  platform       text not null default 'google_meet',
  meet_url       text,
  status         meeting_status not null default 'uploading',
  error_message  text,
  duration_secs  integer,
  language       text,
  speaker_count  integer,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  created_at     timestamptz not null default now()
);

create index meetings_workspace_idx on meetings(workspace_id, created_at desc);
create index meetings_status_idx on meetings(status) where status in ('queued', 'processing');

-- Raw audio chunks as they arrive from the extension. Kept after processing
-- so a failed pipeline run can be retried without re-recording.
create table meeting_chunks (
  id           uuid primary key default uuid_generate_v4(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  seq          integer not null,
  storage_path text not null,
  bytes        integer not null,
  created_at   timestamptz not null default now(),
  unique (meeting_id, seq)
);

-- ─────────────────────────────────────────────────────────
-- TRANSCRIPTS
-- ─────────────────────────────────────────────────────────

-- One row per speaker turn. Chunking for embeddings follows these turns
-- rather than a fixed token count (spec layer 08).
create table transcript_segments (
  id           uuid primary key default uuid_generate_v4(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  seq          integer not null,
  speaker      text not null default 'Speaker 1',
  start_secs   double precision not null,
  end_secs     double precision not null,
  -- text = current (possibly user-corrected) value.
  -- raw_text = what ASR + cleaner produced, kept so corrections stay auditable.
  text         text not null,
  raw_text     text not null,
  language     text,
  edited_at    timestamptz,
  edited_by    uuid references auth.users(id) on delete set null,
  unique (meeting_id, seq)
);

create index transcript_segments_meeting_idx on transcript_segments(meeting_id, seq);

-- ─────────────────────────────────────────────────────────
-- INTELLIGENCE (Month 2)
-- ─────────────────────────────────────────────────────────

create type meeting_template as enum (
  'client_meeting', 'sales_call', 'internal_standup', 'discovery_call', 'project_review'
);

create table meeting_summaries (
  id           uuid primary key default uuid_generate_v4(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template     meeting_template not null,
  -- Template-shaped sections, e.g. {"requirements": [...], "budget": "..."}.
  -- Kept as jsonb because each template returns a different shape.
  sections     jsonb not null default '{}'::jsonb,
  overview     text,
  model        text not null,
  created_at   timestamptz not null default now(),
  unique (meeting_id, template)
);

create type task_status as enum ('open', 'done');

create table action_items (
  id            uuid primary key default uuid_generate_v4(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  text          text not null,
  owner         text,
  due_hint      text,
  status        task_status not null default 'open',
  source_seq    integer,
  created_at    timestamptz not null default now()
);

create index action_items_workspace_idx on action_items(workspace_id, status);
create index action_items_meeting_idx on action_items(meeting_id);

create type insight_kind as enum ('decision', 'risk', 'question', 'blocker');

create table meeting_insights (
  id           uuid primary key default uuid_generate_v4(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind         insight_kind not null,
  text         text not null,
  source_seq   integer,
  created_at   timestamptz not null default now()
);

create index meeting_insights_meeting_idx on meeting_insights(meeting_id, kind);

-- ─────────────────────────────────────────────────────────
-- THE MOAT — WORKSPACE VOCABULARY
-- ─────────────────────────────────────────────────────────

-- wrong → right, scoped to one workspace. Applied to every future meeting
-- in that workspace by the transcript cleaner.
create table vocabulary_terms (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  wrong         text not null,
  right_term    text not null,
  -- 'manual' = typed in settings, 'correction' = learned from a transcript edit
  source        text not null default 'manual',
  hit_count     integer not null default 0,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Case-insensitive uniqueness: "at miss" and "At Miss" are the same correction.
create unique index vocabulary_terms_unique on vocabulary_terms(workspace_id, lower(wrong));
create index vocabulary_terms_workspace_idx on vocabulary_terms(workspace_id);

-- Shared, read-only dictionaries loaded by workspace industry.
-- Seeded from api/app/dictionaries/*.json — not user-editable.
create table industry_terms (
  id         uuid primary key default uuid_generate_v4(),
  industry   workspace_industry not null,
  wrong      text not null,
  right_term text not null,
  unique (industry, wrong)
);

-- Audit trail of transcript edits. Doubles as the training signal for
-- Month 5 vocabulary auto-suggest.
create table transcript_corrections (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  meeting_id   uuid not null references meetings(id) on delete cascade,
  segment_id   uuid not null references transcript_segments(id) on delete cascade,
  before_text  text not null,
  after_text   text not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index transcript_corrections_workspace_idx on transcript_corrections(workspace_id, created_at desc);

-- ─────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────

alter table workspaces            enable row level security;
alter table workspace_members     enable row level security;
alter table meetings              enable row level security;
alter table meeting_chunks        enable row level security;
alter table transcript_segments   enable row level security;
alter table meeting_summaries     enable row level security;
alter table action_items          enable row level security;
alter table meeting_insights      enable row level security;
alter table vocabulary_terms      enable row level security;
alter table transcript_corrections enable row level security;
alter table industry_terms        enable row level security;

-- Membership test used by every policy below.
-- SECURITY DEFINER so the function can read workspace_members without
-- recursively triggering that table's own RLS policy.
create or replace function is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function has_workspace_role(ws uuid, roles workspace_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = any(roles)
  );
$$;

-- workspaces
create policy workspaces_select on workspaces
  for select using (is_workspace_member(id));
create policy workspaces_insert on workspaces
  for insert with check (created_by = auth.uid());
create policy workspaces_update on workspaces
  for update using (has_workspace_role(id, array['owner','admin']::workspace_role[]));

-- workspace_members: members see the roster; only owners/admins change it.
create policy members_select on workspace_members
  for select using (is_workspace_member(workspace_id));
create policy members_insert on workspace_members
  for insert with check (
    has_workspace_role(workspace_id, array['owner','admin']::workspace_role[])
    -- Bootstrap: the workspace creator adds themselves as the first member,
    -- at which point no membership row exists yet for the role check above.
    or exists (select 1 from workspaces w where w.id = workspace_id and w.created_by = auth.uid())
  );
create policy members_delete on workspace_members
  for delete using (has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

-- Meeting data: full access for any member of the owning workspace.
create policy meetings_all on meetings
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy chunks_all on meeting_chunks
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy segments_all on transcript_segments
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy summaries_all on meeting_summaries
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy action_items_all on action_items
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy insights_all on meeting_insights
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy vocabulary_all on vocabulary_terms
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy corrections_all on transcript_corrections
  for all using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- Industry dictionaries are global reference data: readable by any signed-in
-- user, writable only by the service role (which bypasses RLS).
create policy industry_terms_select on industry_terms
  for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────
-- STORAGE
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('meeting-audio', 'meeting-audio', false)
on conflict (id) do nothing;

-- Audio paths are {workspace_id}/{meeting_id}/{seq}.webm, so the first path
-- segment is the workspace gate.
create policy meeting_audio_rw on storage.objects
  for all using (
    bucket_id = 'meeting-audio'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'meeting-audio'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
