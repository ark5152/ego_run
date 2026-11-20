-- 아이콘(배지) 획득 기능의 "판정 장치"
-- 실제 아이콘 목록·이름·설명·획득 조건은 이 파일에 없습니다(공개 저장소에 올리지 않음).
-- 개발자가 따로 받은 비공개 SQL(badges_seed.sql)로 badges / special_days 표를 채웁니다.
-- 회원·운영진은 앱에서 badges·special_days 표를 읽을 수 없고, 자기가 얻은 아이콘만 볼 수 있습니다.

-- 기능을 켠 날(이날 이후 기록만 인정)
alter table public.settings add column if not exists badge_start date not null default ((now() at time zone 'Asia/Seoul')::date);

create table if not exists public.badges (
  id          text primary key,           -- 무작위 id (= public/badges/<id>.png)
  name        text not null,
  description text not null default '',
  rule        jsonb not null,             -- 획득 조건
  sort        int not null default 0,
  active      boolean not null default true
);
alter table public.badges enable row level security;          -- 정책 없음 = 앱에서 읽기 불가
revoke all on public.badges from anon, authenticated;

create table if not exists public.special_days (               -- 음력·절기 날짜표(설·추석 연휴, 부처님오신날, 복날 등)
  day date not null,
  key text not null,
  primary key (day, key)
);
alter table public.special_days enable row level security;
revoke all on public.special_days from anon, authenticated;

create table if not exists public.member_badges (
  member_id  uuid not null references public.members(id) on delete cascade,
  badge_id   text not null references public.badges(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  seen       boolean not null default false,   -- 획득 팝업을 봤는지
  primary key (member_id, badge_id)
);
alter table public.member_badges enable row level security;
revoke all on public.member_badges from anon, authenticated;

-- 대표 아이콘(다른 회원에게도 보임: 홈 이름 옆, 참석 랭킹)
alter table public.members add column if not exists badge_id text references public.badges(id) on delete set null;

-- ───────── 판정 ─────────
create or replace function public.badge_rule_met(p_member uuid, p_rule jsonb, p_start date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  t text := p_rule->>'type';
begin
  -- 러닝 일정 출석(기능을 켠 날 이후 ~ 오늘)
  if t = 'date' then
    return exists (select 1 from attendance a join events e on e.id = a.event_id
      where a.member_id = p_member and e.kind = 'run' and e.date between p_start and today
        and to_char(e.date, 'MM-DD') in (select jsonb_array_elements_text(p_rule->'md')));
  elsif t = 'range' then
    return exists (select 1 from attendance a join events e on e.id = a.event_id
      where a.member_id = p_member and e.kind = 'run' and e.date between p_start and today
        and to_char(e.date, 'MM-DD') between p_rule->>'from' and p_rule->>'to');
  elsif t = 'special' then
    return exists (select 1 from attendance a join events e on e.id = a.event_id
      where a.member_id = p_member and e.kind = 'run' and e.date between p_start and today
        and e.date in (select day from special_days where key = p_rule->>'key'));
  elsif t = 'race' then
    return exists (select 1 from race_records r
      where r.member_id = p_member and r.course = p_rule->>'course' and r.created_at >= p_start);
  elsif t = 'kind_count' then
    return (select count(*) from attendance a join events e on e.id = a.event_id
      where a.member_id = p_member and e.kind = p_rule->>'kind' and e.date between p_start and today) >= (p_rule->>'min')::int;
  elsif t = 'month_count' then
    return exists (select 1 from attendance a join events e on e.id = a.event_id
      where a.member_id = p_member and e.kind = 'run' and e.date between p_start and today
        and extract(month from e.date)::int in (select jsonb_array_elements_text(p_rule->'months')::int)
      group by date_trunc('month', e.date) having count(*) >= (p_rule->>'min')::int);
  elsif t = 'monthly_top' then
    -- 끝난 달마다 러닝 출석 1등(공동 1등 모두, 1회 이상)
    return exists (
      with c as (
        select a.member_id, date_trunc('month', e.date) m, count(*) n
          from attendance a join events e on e.id = a.event_id join members mm on mm.id = a.member_id
         where e.kind = 'run' and e.date >= p_start and e.date < date_trunc('month', today) and mm.status = 'active'
         group by 1, 2)
      select 1 from c where c.member_id = p_member and c.n >= 1 and c.n = (select max(n) from c c2 where c2.m = c.m));
  elsif t = 'weekday_streak' then
    -- 실제로 열린 해당 요일 러닝 일정을 연속으로 참석한 횟수
    return coalesce((
      with ev as (
        select e.date, bool_or(a.member_id is not null) att
          from events e left join attendance a on a.event_id = e.id and a.member_id = p_member
         where e.kind = 'run' and extract(isodow from e.date)::int = (p_rule->>'dow')::int and e.date between p_start and today
         group by e.date),
      g as (select att, sum(case when att then 0 else 1 end) over (order by date) grp from ev)
      select max(cnt) from (select grp, count(*) cnt from g where att group by grp) x), 0) >= (p_rule->>'min')::int;
  end if;
  return false;
end $$;
revoke all on function public.badge_rule_met(uuid, jsonb, date) from public, anon, authenticated;

-- 앱을 열 때: 새로 조건을 채운 아이콘을 지급하고, 아직 팝업을 안 본 아이콘을 돌려줌
create or replace function public.claim_badges() returns table (id text, name text, description text)
language plpgsql security definer set search_path = public as $$
declare m uuid := my_member_id(); st date;
begin
  if m is null then return; end if;
  select badge_start into st from settings where settings.id = 1;
  insert into member_badges (member_id, badge_id)
    select m, b.id from badges b
     where b.active and not exists (select 1 from member_badges mb where mb.member_id = m and mb.badge_id = b.id)
       and badge_rule_met(m, b.rule, st)
    on conflict do nothing;
  return query select b.id, b.name, b.description from member_badges mb join badges b on b.id = mb.badge_id
    where mb.member_id = m and not mb.seen order by mb.earned_at, b.sort;
end $$;

create or replace function public.mark_badges_seen(p_ids text[]) returns void
language sql security definer set search_path = public as $$
  update member_badges set seen = true where member_id = my_member_id() and badge_id = any(p_ids)
$$;

-- 내가 얻은 아이콘(이름·설명은 얻은 것만) + 전체 개수
create or replace function public.my_badges() returns table (id text, name text, description text, earned_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.description, mb.earned_at from member_badges mb join badges b on b.id = mb.badge_id
   where mb.member_id = my_member_id() order by b.sort, mb.earned_at
$$;

create or replace function public.badge_total() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from badges where active
$$;

-- 대표 아이콘 설정(얻은 것만) / null 이면 해제
create or replace function public.set_my_badge(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare m uuid := my_member_id();
begin
  if m is null then raise exception '로그인이 필요해요'; end if;
  if p_id is not null and not exists (select 1 from member_badges where member_id = m and badge_id = p_id) then
    raise exception '아직 얻지 못한 아이콘이에요';
  end if;
  update members set badge_id = p_id where id = m;
end $$;

revoke all on function public.claim_badges(), public.mark_badges_seen(text[]), public.my_badges(), public.badge_total(), public.set_my_badge(text) from public, anon;
grant execute on function public.claim_badges(), public.mark_badges_seen(text[]), public.my_badges(), public.badge_total(), public.set_my_badge(text) to authenticated;
