-- 이미 schema.sql 을 실행한 프로젝트용 변경분 (SQL Editor 에서 한 번 실행)
-- 1) 일정 구분에 '친목'(social), '기타'(etc) 추가
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('run','event','social','etc'));
-- 2) 크루 인스타그램 계정
alter table public.settings add column if not exists instagram text not null default '';
