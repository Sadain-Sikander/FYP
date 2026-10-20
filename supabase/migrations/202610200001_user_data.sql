-- Run once in your Supabase project's SQL editor, or apply with the Supabase CLI.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 64000),
  updated_at timestamptz not null default now()
);

create table public.saved_careers (
  user_id uuid not null references auth.users(id) on delete cascade,
  career_id text not null check (length(career_id) between 1 and 300),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 64000),
  created_at timestamptz not null default now(),
  primary key (user_id, career_id)
);

create table public.saved_roadmaps (
  user_id uuid not null references auth.users(id) on delete cascade,
  career_id text not null check (length(career_id) between 1 and 300),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 64000),
  updated_at timestamptz not null default now(),
  primary key (user_id, career_id)
);

alter table public.profiles enable row level security;
alter table public.saved_careers enable row level security;
alter table public.saved_roadmaps enable row level security;

-- Explicit grants plus RLS: the public key alone cannot access user data.
revoke all on public.profiles, public.saved_careers, public.saved_roadmaps from anon;
grant select, insert, update, delete on public.profiles, public.saved_careers, public.saved_roadmaps to authenticated;

create policy "Manage own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Manage own saved careers" on public.saved_careers
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Manage own roadmaps" on public.saved_roadmaps
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
