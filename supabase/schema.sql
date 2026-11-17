-- EGO 러닝크루 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요. (여러 번 실행해도 안전하지 않으니 처음 한 번만)

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
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
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
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  delete from attendance where event_id = p_event_id;
  insert into attendance (event_id, member_id)
    select p_event_id, unnest(p_member_ids);
end $$;

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
