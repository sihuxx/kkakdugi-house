-- ===============================================================
-- 꺅두기 하우스 — 서버 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하세요.
--
-- 핵심: 이 파일의 RLS 정책이 진짜 방어선입니다.
--       브라우저의 anon key 는 공개되는 게 정상이고,
--       "누가 무엇을 읽고 쓸 수 있는가" 는 전부 여기서 정해집니다.
-- ===============================================================

-- ── 세이브 테이블 ───────────────────────────────────────────
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- 서버에서도 크기를 막는다 (한 사람이 저장소를 다 먹지 못하게)
  constraint saves_size_ok check (pg_column_size(data) <= 500000),
  -- 최상위는 반드시 객체
  constraint saves_shape_ok check (jsonb_typeof(data) = 'object')
);

-- ── 행 단위 보안 (RLS) ─────────────────────────────────────
-- 이걸 켜지 않으면 anon key 만으로 남의 세이브를 전부 읽을 수 있습니다.
alter table public.saves enable row level security;
-- 테이블 주인도 정책을 우회하지 못하게
alter table public.saves force row level security;

drop policy if exists "본인 것만 읽기"   on public.saves;
drop policy if exists "본인 것만 만들기" on public.saves;
drop policy if exists "본인 것만 고치기" on public.saves;
drop policy if exists "본인 것만 지우기" on public.saves;

create policy "본인 것만 읽기" on public.saves
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "본인 것만 만들기" on public.saves
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "본인 것만 고치기" on public.saves
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "본인 것만 지우기" on public.saves
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- 로그인하지 않은 사람(anon)에게는 아무 권한도 주지 않는다
revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

-- ── 들어오는 값 검증 ────────────────────────────────────────
-- 브라우저는 믿을 수 없습니다. user_id 위조와 말도 안 되는 수치를 서버에서 막습니다.
create or replace function public.saves_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n numeric;
begin
  -- 남의 user_id 로 쓰려는 시도 차단 (RLS 와 이중으로)
  new.user_id := (select auth.uid());
  if new.user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  new.updated_at := now();

  -- 사람이 낼 수 없는 값은 거부 (치팅·오염 방지)
  n := coalesce((new.data->>'clover')::numeric, 0);
  if n < 0 or n > 50000000 then raise exception '값이 올바르지 않습니다'; end if;

  n := coalesce((new.data#>>'{dugi,love}')::numeric, 0);
  if n < 0 or n > 50000000 then raise exception '값이 올바르지 않습니다'; end if;

  for n in
    select (new.data#>>array['dugi', k])::numeric
    from unnest(array['full','clean','fun','energy']) as k
  loop
    if n is not null and (n < 0 or n > 100) then
      raise exception '값이 올바르지 않습니다';
    end if;
  end loop;

  -- 이름 길이·글자 제한 (XSS 를 서버에서도 한 번 더 막는다)
  if new.data#>>'{dugi,name}' is not null then
    if length(new.data#>>'{dugi,name}') > 8
       or new.data#>>'{dugi,name}' ~ '[<>&"''`\\]' then
      raise exception '이름이 올바르지 않습니다';
    end if;
  end if;

  -- 사진 개수 제한
  if jsonb_typeof(new.data->'album') = 'array'
     and jsonb_array_length(new.data->'album') > 12 then
    raise exception '사진이 너무 많습니다';
  end if;

  return new;
end;
$$;

drop trigger if exists saves_guard_ins on public.saves;
drop trigger if exists saves_guard_upd on public.saves;
create trigger saves_guard_ins before insert on public.saves
  for each row execute function public.saves_guard();
create trigger saves_guard_upd before update on public.saves
  for each row execute function public.saves_guard();

-- ── 저장 횟수 제한 (한 사람이 초당 수천 번 쓰지 못하게) ──────
create table if not exists public.save_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.save_rate enable row level security;
alter table public.save_rate force row level security;
revoke all on public.save_rate from anon, authenticated;

create or replace function public.saves_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.save_rate%rowtype;
begin
  select * into r from public.save_rate where user_id = (select auth.uid()) for update;
  if not found then
    insert into public.save_rate(user_id, window_start, hits)
      values ((select auth.uid()), now(), 1);
    return new;
  end if;
  if now() - r.window_start > interval '1 minute' then
    update public.save_rate set window_start = now(), hits = 1 where user_id = r.user_id;
  else
    if r.hits >= 30 then
      raise exception '너무 자주 저장하고 있어요. 잠시 후 다시 시도해주세요';
    end if;
    update public.save_rate set hits = r.hits + 1 where user_id = r.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists saves_rate_ins on public.saves;
drop trigger if exists saves_rate_upd on public.saves;
create trigger saves_rate_ins before insert on public.saves
  for each row execute function public.saves_rate_limit();
create trigger saves_rate_upd before update on public.saves
  for each row execute function public.saves_rate_limit();


-- ═══════════════════════════════════════════════════════════
--  순위표 (알바 최고 기록)
--
--  점수는 브라우저가 세서 보냅니다. 서버는 브라우저를 믿지 않으므로
--  "말이 되는 범위" 밖은 아예 받지 않습니다. 그래도 범위 안에서의
--  위조는 막을 수 없습니다 — 그건 Edge Function 으로 옮겨야 풀립니다.
--  (SECURITY.md 10장에 정직하게 적어뒀습니다)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  job        text not null check (job in ('deliver','mine','draw')),
  name       text not null default '두기',
  best       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, job),
  -- 알바마다 사람이 낼 수 있는 최대치보다 넉넉히 위에서 자른다
  constraint scores_range check (
    (job = 'deliver' and best between 0 and 200000) or
    (job = 'mine'    and best between 0 and 30)     or   -- 깊이(m)
    (job = 'draw'    and best between 0 and 100000)
  ),
  constraint scores_name_len   check (char_length(name) between 1 and 8),
  constraint scores_name_clean check (name !~ '[<>&"''`\\]')
);

create index if not exists scores_board on public.scores (job, best desc, updated_at);

alter table public.scores enable row level security;
alter table public.scores force row level security;

-- 읽기: 로그인한 사람은 순위표를 볼 수 있다 (이름과 점수만 들어 있음)
drop policy if exists "순위표는 로그인하면 볼 수 있다" on public.scores;
create policy "순위표는 로그인하면 볼 수 있다"
  on public.scores for select to authenticated using (true);

-- 쓰기: 자기 줄만
drop policy if exists "내 기록만 올린다" on public.scores;
create policy "내 기록만 올린다"
  on public.scores for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "내 기록만 고친다" on public.scores;
create policy "내 기록만 고친다"
  on public.scores for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "내 기록만 지운다" on public.scores;
create policy "내 기록만 지운다"
  on public.scores for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.scores from anon;

-- 들어오는 값을 서버가 한 번 더 손본다
create or replace function public.scores_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := (select auth.uid());          -- 남의 이름으로 못 올린다
  new.updated_at := now();
  new.name := left(regexp_replace(coalesce(new.name, '두기'), '[<>&"''`\\]', '', 'g'), 8);
  if char_length(new.name) = 0 then new.name := '두기'; end if;
  new.best := greatest(0, new.best);
  -- 기록은 내려가지 않는다
  if tg_op = 'UPDATE' and new.best < old.best then new.best := old.best; end if;
  return new;
end;
$$;

drop trigger if exists scores_guard_ins on public.scores;
drop trigger if exists scores_guard_upd on public.scores;
create trigger scores_guard_ins before insert on public.scores
  for each row execute function public.scores_guard();
create trigger scores_guard_upd before update on public.scores
  for each row execute function public.scores_guard();

-- 올리는 횟수 제한 — saves 와 같은 방식 (1분에 20번)
create or replace function public.scores_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.save_rate%rowtype;
begin
  select * into r from public.save_rate where user_id = (select auth.uid()) for update;
  if not found then
    insert into public.save_rate(user_id, window_start, hits)
      values ((select auth.uid()), now(), 1);
    return new;
  end if;
  if now() - r.window_start > interval '1 minute' then
    update public.save_rate set window_start = now(), hits = 1 where user_id = r.user_id;
  else
    if r.hits >= 50 then
      raise exception '너무 자주 올리고 있어요. 잠시 후 다시 시도해주세요';
    end if;
    update public.save_rate set hits = r.hits + 1 where user_id = r.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists scores_rate_ins on public.scores;
drop trigger if exists scores_rate_upd on public.scores;
create trigger scores_rate_ins before insert on public.scores
  for each row execute function public.scores_rate_limit();
create trigger scores_rate_upd before update on public.scores
  for each row execute function public.scores_rate_limit();

-- ── 확인용 ─────────────────────────────────────────────────
-- 아래가 전부 true 로 나와야 합니다.
-- select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname in ('saves','save_rate','scores');
