-- 신입: 가입이 승인된 그 달에는 참석·거리 기준 판단에서 빼 줌
-- newbie_start 이후 승인된 회원부터 적용(앱 이동으로 새로 가입하는 기존 회원은 제외)
alter table public.members  add column if not exists approved_at timestamptz;
alter table public.settings add column if not exists newbie_start date not null default '2026-12-01';

-- 가입 승인 시 승인 시각 기록
create or replace function public.review_join(p_member_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영진만 할 수 있어요'; end if;
  if p_approve then
    update members set status = 'active', approved_at = now() where id = p_member_id and status = 'pending';
  else
    delete from member_secrets where member_id = p_member_id;
    update members set status = 'unclaimed', user_id = null where id = p_member_id and status = 'pending';
  end if;
end $$;
