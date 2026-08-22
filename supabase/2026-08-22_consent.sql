-- ═══════════════════════════════════════════════════════════
--  2026-08-22 · 개인정보 수집·이용 동의 기록
--
--  필수 동의 없이는 접수 자체가 되지 않도록 DB 수준에서 강제합니다.
--  화면 체크박스는 우회될 수 있으므로 여기서 한 번 더 막습니다.
--
--  실행 순서: schema.sql → 2026-08-22_harden_anon_insert.sql → 이 파일
--  재실행 가능합니다.
-- ═══════════════════════════════════════════════════════════

alter table public.rfq add column if not exists agreed_at        timestamptz;
alter table public.rfq add column if not exists marketing_opt_in boolean not null default false;

comment on column public.rfq.agreed_at        is '개인정보 수집·이용 필수 동의 시각';
comment on column public.rfq.marketing_opt_in is '마케팅 수신 선택 동의';

-- 익명 접수에는 동의 시각이 반드시 있어야 합니다
drop policy if exists "anon insert rfq" on public.rfq;
create policy "anon insert rfq" on public.rfq
  for insert to anon with check (
    status = '접수'
    and rfq_no ~ '^MB-[0-9]{6}-[0-9]{3}$'
    and source = 'web'
    and memo is null
    and agreed_at is not null                      -- 필수 동의 없이는 접수 불가
    and agreed_at <= now() + interval '5 minutes'  -- 미래 시각 방지
    and agreed_at >= now() - interval '1 day'
  );

-- 백오피스 목록에서도 동의 여부를 보이게 합니다
create or replace view public.rfq_board as
select
  r.id, r.rfq_no, r.created_at, r.status, r.contact, r.company,
  r.due, r.place, r.item_count, r.sendable,
  r.agreed_at, r.marketing_opt_in,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id) as supplier_count,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id and s.replied_at is not null) as replied_count
from public.rfq r
order by r.created_at desc;

alter view public.rfq_board set (security_invoker = on);
revoke all on public.rfq_board from anon;
grant select on public.rfq_board to authenticated;

-- ── 확인
--   select rfq_no, agreed_at, marketing_opt_in from public.rfq order by created_at desc limit 5;
