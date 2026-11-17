-- 친목 일정은 매월 3회까지(이월 없음). 앱 화면에서도 막지만 DB 에서도 한 번 더 막습니다.
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
