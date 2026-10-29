-- =============================================================================
-- Quadern de notes · Institut Candelera
-- Preparació de la base de dades de Supabase.
--
-- Com s'executa: panell de Supabase → SQL Editor → New query → enganxeu tot
-- aquest fitxer → Run. Es pot tornar a executar sense perill.
-- =============================================================================

-- Perfil de cada professor: nom d'usuari i nom complet.
-- Es crea sol quan doneu d'alta un usuari (vegeu el disparador de més avall).
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  full_name  text not null,
  created_at timestamptz not null default now()
);

-- Quadern de cada professor: totes les seves matèries, alumnes i notes en un
-- sol document JSON. «version» evita que dues pestanyes es trepitgin els canvis.
create table if not exists public.notebooks (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Seguretat (RLS): cada professor només pot llegir i modificar el que és seu.
-- Sense aquestes regles, la clau pública donaria accés a tot.
-- -----------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.notebooks enable row level security;

drop policy if exists "Cada professor veu el seu perfil" on public.profiles;
create policy "Cada professor veu el seu perfil"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Cada professor llegeix el seu quadern" on public.notebooks;
create policy "Cada professor llegeix el seu quadern"
  on public.notebooks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Cada professor crea el seu quadern" on public.notebooks;
create policy "Cada professor crea el seu quadern"
  on public.notebooks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Cada professor modifica el seu quadern" on public.notebooks;
create policy "Cada professor modifica el seu quadern"
  on public.notebooks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Ningú (excepte l'administrador des del panell) pot esborrar quaderns ni
-- crear o canviar perfils des de l'app: no hi ha regles per a això.

-- -----------------------------------------------------------------------------
-- Perfil automàtic: en crear un usuari «mpuig@candelera.local», es crea el
-- perfil amb usuari «mpuig». El nom complet es pot canviar després a
-- Table Editor → profiles.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfils dels usuaris que ja existissin abans d'executar aquest script.
insert into public.profiles (id, username, full_name)
select id, split_part(email, '@', 1), split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;
