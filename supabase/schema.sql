-- EGO 러닝크루 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요. (처음 한 번만)
-- 이미 실행한 프로젝트는 supabase/migrations/ 의 새 파일만 실행하세요.

-- ───────────────────────── 테이블 ─────────────────────────

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  gender      text not null default 'M' check (gender in ('M','F')),
  role        text not null default 'member' check (role in ('member','admin')),
  is_leader   boolean not null default false,
  status      text not null default 'unclaimed' check (status in ('unclaimed','pending','active')),
  user_id     uuid unique references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.settings (
  id               int primary key default 1 check (id = 1),
  min_attendance   int not null default 1 check (min_attendance >= 0),
  distance_target  numeric(6,1) not null default 30 check (distance_target >= 0),
  instagram        text not null default ''
);
insert into public.settings (id) values (1);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  kind        text not null default 'run' check (kind in ('run','event','social','etc')),
  created_at  timestamptz not null default now()
);
create index on public.events (date);

create table public.attendance (
  event_id   uuid not null references public.events(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  primary key (event_id, member_id)
);
create index on public.attendance (member_id);

create table public.distance_submissions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-\d{2}$'),
  km           numeric(6,1) not null check (km > 0 and km < 10000),
  photo_path   text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index on public.distance_submissions (month);
create index on public.distance_submissions (member_id);

create table public.race_records (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  course      text not null check (course in ('full','half','10k')),
  seconds     int not null check (seconds > 0),
  race_name   text not null default '',
  race_date   date not null,
  created_at  timestamptz not null default now()
);
create index on public.race_records (race_date);

-- ───────────────────────── 권한 헬퍼 ─────────────────────────

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and status = 'active' and role = 'admin')
$$;

-- 가입 요청: 로그인한 사람이 명단에서 자기 이름을 고른다
create or replace function public.request_join(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception '이미 요청했거나 가입된 계정이에요';
  end if;
  update members set user_id = auth.uid(), status = 'pending'
   where id = p_member_id and status = 'unclaimed' and user_id is null;
  if not found then raise exception '이미 다른 사람이 선택한 이름이에요'; end if;
end $$;

-- 내 가입 요청 취소 (승인 전만)
create or replace function public.cancel_join() returns void
language sql security definer set search_path = public as $$
  update members set user_id = null, status = 'unclaimed'
   where user_id = auth.uid() and status = 'pending'
$$;

-- 관리자: 가입 승인/반려
create or replace function public.review_join(p_member_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  if p_approve then
    update members set status = 'active' where id = p_member_id and status = 'pending';
  else
    update members set status = 'unclaimed', user_id = null where id = p_member_id and status = 'pending';
  end if;
end $$;

-- 관리자: 한 일정의 출석자를 통째로 교체
create or replace function public.set_attendance(p_event_id uuid, p_member_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  delete from attendance where event_id = p_event_id;
  insert into attendance (event_id, member_id)
    select p_event_id, unnest(p_member_ids);
end $$;

-- 운영진: 일정과 참석자를 한 번에 저장(중간에 실패하면 둘 다 취소)
create or replace function public.create_event(p_date date, p_title text, p_kind text, p_member_ids uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '제목을 입력해 주세요'; end if;
  insert into events (date, title, kind) values (p_date, trim(p_title), p_kind) returning id into v_id;
  insert into attendance (event_id, member_id)
    select v_id, m from unnest(coalesce(p_member_ids, '{}')) as m
    on conflict do nothing;
  return v_id;
end $$;

-- 친목 일정은 매월 3회까지(이월 없음)
create or replace function public.limit_social_events() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'social' and (
    select count(*) from events
     where kind = 'social' and id <> new.id
       and date_trunc('month', date) = date_trunc('month', new.date)
  ) >= 3 then
    raise exception '친목 일정은 한 달에 3회까지 등록할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists events_social_limit on public.events;
create trigger events_social_limit before insert or update on public.events
  for each row execute function public.limit_social_events();

-- ───────────────────────── RLS ─────────────────────────

alter table public.members enable row level security;
alter table public.settings enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.distance_submissions enable row level security;
alter table public.race_records enable row level security;

-- members: 로그인한 사람은 명단을 볼 수 있음(가입 화면에서 이름 선택), 수정은 관리자
create policy members_read  on public.members for select to authenticated using (true);
create policy members_admin on public.members for all    to authenticated using (is_admin()) with check (is_admin());

create policy settings_read  on public.settings for select to authenticated using (is_active());
create policy settings_admin on public.settings for update to authenticated using (is_admin()) with check (is_admin());

create policy events_read  on public.events for select to authenticated using (is_active());
create policy events_admin on public.events for all    to authenticated using (is_admin()) with check (is_admin());

create policy attendance_read  on public.attendance for select to authenticated using (is_active());
create policy attendance_admin on public.attendance for all    to authenticated using (is_admin()) with check (is_admin());

-- 거리: 활동 회원은 모두 조회(랭킹·현황), 본인만 제출, 관리자만 인정/반려
create policy distance_read   on public.distance_submissions for select to authenticated using (is_active());
create policy distance_insert on public.distance_submissions for insert to authenticated
  with check (member_id = my_member_id() and status = 'pending');
create policy distance_admin  on public.distance_submissions for update to authenticated using (is_admin()) with check (is_admin());
create policy distance_delete on public.distance_submissions for delete to authenticated
  using (is_admin() or (member_id = my_member_id() and status = 'pending'));

-- 대회 기록: 활동 회원은 조회, 본인 기록 등록/삭제, 관리자는 전부
create policy race_read   on public.race_records for select to authenticated using (is_active());
create policy race_insert on public.race_records for insert to authenticated
  with check (member_id = my_member_id() or is_admin());
create policy race_delete on public.race_records for delete to authenticated
  using (member_id = my_member_id() or is_admin());

-- ───────────────────────── 거리 인증 사진 저장소 ─────────────────────────

insert into storage.buckets (id, name, public) values ('distance-photos', 'distance-photos', false);

-- 경로 규칙: <auth uid>/<파일명>
create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'distance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'distance-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- ───────────────────────── 이름 + 비밀번호 로그인 (migrations/005 와 같음) ─────────────────────────

-- 이름 + 비밀번호 로그인
--   크루원: 숫자 4자리 / 운영진: 영문+숫자 포함 8자리 이상
--   5번 틀리면 10분 잠금, 잠금이 3번 쌓이면 운영진이 초기화해야 풀림
--   비밀번호는 암호화(bcrypt)해서 저장 — 운영진·개발자도 원래 값을 볼 수 없음
--   확인은 Edge Function(pin-auth)이 서버 키로만 호출 — 앱에서는 이 표와 함수에 접근할 수 없음

create extension if not exists pgcrypto with schema extensions;

-- 로그인할 때 이름으로 찾으므로 같은 이름은 등록할 수 없게
create unique index if not exists members_name_unique on public.members (name);

create table if not exists public.member_secrets (
  member_id     uuid primary key references public.members(id) on delete cascade,
  hash          text,              -- null 이면 초기화된 상태(재설정 코드로 새로 정해야 함)
  kind          text not null default 'pin' check (kind in ('pin', 'password')),
  failed        int  not null default 0,
  lock_count    int  not null default 0,
  locked_until  timestamptz,
  reset_hash    text,
  reset_expires timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.member_secrets enable row level security;
-- 정책을 하나도 만들지 않음 → 회원·운영진 모두 읽기/쓰기 불가
revoke all on public.member_secrets from anon, authenticated;

-- ───────── 비밀번호 규칙 ─────────
create or replace function public.secret_error(p_secret text, p_kind text) returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_kind = 'pin' then
    if p_secret is null or p_secret !~ '^\d{4}$' then return '비밀번호는 숫자 4자리로 정해 주세요'; end if;
    if p_secret ~ '^(\d)\1{3}$' or p_secret in ('0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210') then
      return '1111, 1234처럼 쉬운 번호는 쓸 수 없어요';
    end if;
    return null;
  end if;
  if p_secret is null or length(p_secret) < 8 or p_secret !~ '[A-Za-z]' or p_secret !~ '\d' then
    return '운영진 비밀번호는 영문과 숫자를 섞어 8자리 이상으로 정해 주세요';
  end if;
  return null;
end $$;

-- 운영진(role=admin)이면 'password', 아니면 'pin'
create or replace function public.secret_kind_for(p_member_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when role = 'admin' then 'password' else 'pin' end from members where id = p_member_id
$$;

-- 틀렸을 때 기록 후 안내 문구를 돌려줌(예외를 던지면 기록이 취소되므로 jsonb 로 반환)
create or replace function public.secret_fail(p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s member_secrets;
begin
  update member_secrets set failed = failed + 1, updated_at = now() where member_id = p_member_id returning * into s;
  if s.failed >= 5 then
    update member_secrets
       set failed = 0, lock_count = lock_count + 1,
           locked_until = case when lock_count + 1 >= 3 then 'infinity'::timestamptz else now() + interval '10 minutes' end
     where member_id = p_member_id returning * into s;
    if s.locked_until = 'infinity' then
      return jsonb_build_object('ok', false, 'error', '여러 번 틀려서 잠겼어요. 운영진에게 비밀번호 초기화를 요청해 주세요.');
    end if;
    return jsonb_build_object('ok', false, 'error', '5번 틀려서 10분 동안 잠겼어요.');
  end if;
  return jsonb_build_object('ok', false, 'error', format('이름 또는 비밀번호가 맞지 않아요. (%s번 더 틀리면 잠겨요)', 5 - s.failed));
end $$;

create or replace function public.secret_locked(s public.member_secrets) returns jsonb
language sql stable set search_path = public as $$
  select case
    when s.locked_until = 'infinity' then jsonb_build_object('ok', false, 'error', '여러 번 틀려서 잠겼어요. 운영진에게 비밀번호 초기화를 요청해 주세요.')
    when s.locked_until > now() then jsonb_build_object('ok', false, 'error',
      format('잠겨 있어요. %s분 뒤에 다시 시도해 주세요.', greatest(1, ceil(extract(epoch from s.locked_until - now()) / 60)::int)))
  end
$$;

-- ───────── 서버(Edge Function) 전용 함수 ─────────

-- 처음 가입: 명단의 이름 + 4자리 → 승인 대기
create or replace function public.auth_register(p_name text, p_pin text, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m members; err text;
begin
  select * into m from members where name = trim(p_name);
  if not found then return jsonb_build_object('ok', false, 'error', '명단에 없는 이름이에요. 운영진에게 명단 등록을 요청해 주세요.'); end if;
  if m.user_id is not null or m.status <> 'unclaimed' then
    return jsonb_build_object('ok', false, 'error', '이미 가입한 이름이에요. 로그인해 주세요.');
  end if;
  err := secret_error(p_pin, 'pin');
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  update members set user_id = p_user_id, status = 'pending' where id = m.id;
  insert into member_secrets (member_id, hash, kind) values (m.id, crypt(p_pin, gen_salt('bf', 10)), 'pin')
    on conflict (member_id) do update set hash = excluded.hash, kind = 'pin', failed = 0, lock_count = 0,
      locked_until = null, reset_hash = null, reset_expires = null, updated_at = now();
  return jsonb_build_object('ok', true, 'user_id', p_user_id);
end $$;

-- 로그인
create or replace function public.auth_login(p_name text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m members; s member_secrets; locked jsonb;
begin
  select * into m from members where name = trim(p_name) and user_id is not null;
  if not found then return jsonb_build_object('ok', false, 'error', '이름 또는 비밀번호가 맞지 않아요.'); end if;
  select * into s from member_secrets where member_id = m.id;
  if not found then return jsonb_build_object('ok', false, 'error', '이름 또는 비밀번호가 맞지 않아요.'); end if;
  locked := secret_locked(s);
  if locked is not null then return locked; end if;
  if s.hash is null then
    return jsonb_build_object('ok', false, 'error', '비밀번호가 초기화됐어요. ‘재설정’에서 운영진에게 받은 코드로 새로 정해 주세요.');
  end if;
  if s.hash <> crypt(coalesce(p_secret, ''), s.hash) then return secret_fail(m.id); end if;
  update member_secrets set failed = 0, lock_count = 0, locked_until = null, updated_at = now() where member_id = m.id;
  return jsonb_build_object('ok', true, 'user_id', m.user_id);
end $$;

-- 재설정 코드로 새 비밀번호 정하기
create or replace function public.auth_reset(p_name text, p_code text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m members; s member_secrets; locked jsonb; k text; err text;
begin
  select * into m from members where name = trim(p_name) and user_id is not null;
  if not found then return jsonb_build_object('ok', false, 'error', '이름 또는 재설정 코드가 맞지 않아요.'); end if;
  select * into s from member_secrets where member_id = m.id;
  if not found or s.reset_hash is null then return jsonb_build_object('ok', false, 'error', '이름 또는 재설정 코드가 맞지 않아요.'); end if;
  if s.reset_expires < now() then return jsonb_build_object('ok', false, 'error', '재설정 코드가 만료됐어요. 운영진에게 다시 요청해 주세요.'); end if;
  locked := secret_locked(s);
  if locked is not null and s.locked_until <> 'infinity' then return locked; end if;
  if s.reset_hash <> crypt(coalesce(p_code, ''), s.reset_hash) then
    if s.locked_until = 'infinity' then return jsonb_build_object('ok', false, 'error', '이름 또는 재설정 코드가 맞지 않아요.'); end if;
    return secret_fail(m.id);
  end if;
  k := secret_kind_for(m.id);
  err := secret_error(p_secret, k);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  update member_secrets set hash = crypt(p_secret, gen_salt('bf', 10)), kind = k, failed = 0, lock_count = 0,
    locked_until = null, reset_hash = null, reset_expires = null, updated_at = now() where member_id = m.id;
  return jsonb_build_object('ok', true, 'user_id', m.user_id);
end $$;

-- 로그인한 본인이 비밀번호 바꾸기(운영진이 처음 영문+숫자 비밀번호로 바꿀 때도 사용)
create or replace function public.auth_change(p_user_id uuid, p_current text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m members; s member_secrets; locked jsonb; k text; err text;
begin
  select * into m from members where user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', '로그인 정보를 찾을 수 없어요.'); end if;
  select * into s from member_secrets where member_id = m.id;
  if not found or s.hash is null then return jsonb_build_object('ok', false, 'error', '비밀번호를 먼저 재설정해 주세요.'); end if;
  locked := secret_locked(s);
  if locked is not null then return locked; end if;
  if s.hash <> crypt(coalesce(p_current, ''), s.hash) then
    perform secret_fail(m.id);
    return jsonb_build_object('ok', false, 'error', '지금 비밀번호가 맞지 않아요.');
  end if;
  k := secret_kind_for(m.id);
  err := secret_error(p_secret, k);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  update member_secrets set hash = crypt(p_secret, gen_salt('bf', 10)), kind = k, failed = 0, updated_at = now() where member_id = m.id;
  return jsonb_build_object('ok', true);
end $$;

-- 서버 전용으로 잠금: 앱(anon·authenticated)에서는 호출 불가
revoke all on function public.secret_fail(uuid) from public, anon, authenticated;
revoke all on function public.secret_locked(public.member_secrets) from public, anon, authenticated;
revoke all on function public.secret_kind_for(uuid) from public, anon, authenticated;
revoke all on function public.auth_register(text, text, uuid) from public, anon, authenticated;
revoke all on function public.auth_login(text, text) from public, anon, authenticated;
revoke all on function public.auth_reset(text, text, text) from public, anon, authenticated;
revoke all on function public.auth_change(uuid, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select from pg_roles where rolname = 'service_role') then
    grant execute on function public.auth_register(text, text, uuid), public.auth_login(text, text),
      public.auth_reset(text, text, text), public.auth_change(uuid, text, text) to service_role;
  end if;
end $$;

-- ───────── 앱에서 쓰는 함수 ─────────

-- 운영진 권한은 영문+숫자 비밀번호로 바꾼 뒤에만 생김(4자리로는 운영진 기능을 쓸 수 없음)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m join member_secrets s on s.member_id = m.id
     where m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin'
       and s.kind = 'password' and s.hash is not null)
$$;

-- 내 비밀번호 종류('pin' / 'password') — 운영진이 아직 4자리면 앱이 변경 화면을 띄움
create or replace function public.my_secret_kind() returns text
language sql stable security definer set search_path = public as $$
  select s.kind from members m join member_secrets s on s.member_id = m.id where m.user_id = auth.uid()
$$;
revoke all on function public.my_secret_kind() from public, anon;
grant execute on function public.my_secret_kind() to authenticated;

-- 운영진: 비밀번호 초기화 → 6자리 재설정 코드(24시간 유효)를 돌려줌. 잠금도 함께 풀림
create or replace function public.admin_reset_secret(p_member_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare code text;
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  if not exists (select 1 from members where id = p_member_id and user_id is not null) then
    raise exception '아직 가입하지 않은 회원이에요';
  end if;
  code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into member_secrets (member_id, hash, kind) values (p_member_id, null, secret_kind_for(p_member_id))
    on conflict (member_id) do nothing;
  update member_secrets set hash = null, failed = 0, lock_count = 0, locked_until = null,
    reset_hash = crypt(code, gen_salt('bf', 10)), reset_expires = now() + interval '24 hours', updated_at = now()
   where member_id = p_member_id;
  return code;
end $$;
revoke all on function public.admin_reset_secret(uuid) from public, anon;
grant execute on function public.admin_reset_secret(uuid) to authenticated;

-- 가입 요청 취소·반려 시 비밀번호도 지움
create or replace function public.cancel_join() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from member_secrets where member_id in (select id from members where user_id = auth.uid() and status = 'pending');
  update members set user_id = null, status = 'unclaimed' where user_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.review_join(p_member_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  if p_approve then
    update members set status = 'active' where id = p_member_id and status = 'pending';
  else
    delete from member_secrets where member_id = p_member_id;
    update members set status = 'unclaimed', user_id = null where id = p_member_id and status = 'pending';
  end if;
end $$;

-- 이메일 방식의 '이름 고르기'는 더 이상 쓰지 않음(비밀번호 없이 이름을 차지하는 것을 막기 위해 삭제)
drop function if exists public.request_join(uuid);

-- ───────────────────────── 공지 (migrations/006 과 같음) ─────────────────────────

-- 공지: 운영진이 작성, 활동 회원이 조회. 게시 기간 동안 앱을 열면 팝업으로 보임
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 100),
  body        text not null default '' check (char_length(body) <= 2000),
  popup_until date not null,
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists announcements_created_at on public.announcements (created_at desc);

alter table public.announcements enable row level security;
drop policy if exists announcements_read on public.announcements;
drop policy if exists announcements_admin on public.announcements;
create policy announcements_read  on public.announcements for select to authenticated using (is_active());
create policy announcements_admin on public.announcements for all    to authenticated using (is_admin()) with check (is_admin());
