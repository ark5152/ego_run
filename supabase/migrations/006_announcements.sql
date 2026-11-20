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
