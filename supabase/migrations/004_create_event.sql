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
