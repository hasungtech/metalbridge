-- 견적 조건 컬럼 추가
--
-- 재질·형상·치수·수량만으로는 공급처가 단가를 낼 수 없습니다.
-- 표면 마감, 열처리 상태, 절단 여부, 공차, 원산지 제한, 인도 조건, 발주 형태가
-- 모두 단가를 움직입니다. 문답에서 받아 여기에 담습니다.
--
-- 실행 순서: schema.sql → 2026-08-22_harden_anon_insert.sql
--            → 2026-08-22_consent.sql → 이 파일
-- 여러 번 실행해도 안전합니다.

-- ── 1. 컬럼 ──────────────────────────────────────────────────
alter table public.rfq add column if not exists usage      text;  -- 용도
alter table public.rfq add column if not exists finish     text;  -- 표면·마감
alter table public.rfq add column if not exists heat       text;  -- 열처리·조질
alter table public.rfq add column if not exists fab        text;  -- 가공 범위
alter table public.rfq add column if not exists tol        text;  -- 공차
alter table public.rfq add column if not exists origin     text;  -- 원산지 제한
alter table public.rfq add column if not exists incoterm   text;  -- 인도 조건
alter table public.rfq add column if not exists order_type text;  -- 발주 형태

alter table public.rfq_items add column if not exists unit text;  -- 장 · 본 · kg · 톤

-- ── 2. 길이 상한 ─────────────────────────────────────────────
-- 익명 키는 번들에 노출됩니다. 새 컬럼도 반드시 상한을 겁니다.
alter table public.rfq drop constraint if exists rfq_quote_len;
alter table public.rfq add constraint rfq_quote_len check (
  length(coalesce(usage,''))      <= 200 and
  length(coalesce(finish,''))     <= 200 and
  length(coalesce(heat,''))       <= 200 and
  length(coalesce(fab,''))        <= 200 and
  length(coalesce(tol,''))        <= 200 and
  length(coalesce(origin,''))     <= 200 and
  length(coalesce(incoterm,''))   <= 200 and
  length(coalesce(order_type,'')) <= 200
);

alter table public.rfq_items drop constraint if exists rfq_items_unit_len;
alter table public.rfq_items add constraint rfq_items_unit_len check (
  length(coalesce(unit,'')) <= 20
);

-- ── 3. 백오피스 목록 뷰 ──────────────────────────────────────
-- 새 컬럼을 목록에서도 보이게 합니다. 컬럼이 늘어 create or replace 로는 바꿀 수
-- 없으므로 지우고 다시 만듭니다. security_invoker = on 을 다시 걸어야 합니다 —
-- 뷰는 기본이 소유자 권한이라 그대로 두면 RLS 를 우회합니다.
drop view if exists public.rfq_board;
create view public.rfq_board as
select
  r.id, r.rfq_no, r.created_at, r.status, r.contact, r.company,
  r.due, r.place, r.mtc, r.item_count, r.sendable,
  r.agreed_at, r.marketing_opt_in,
  r.usage, r.finish, r.heat, r.fab, r.tol, r.origin, r.incoterm, r.order_type,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id) as supplier_count,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id and s.replied_at is not null) as replied_count
from public.rfq r
order by r.created_at desc;

alter view public.rfq_board set (security_invoker = on);
revoke all on public.rfq_board from anon;
grant select on public.rfq_board to authenticated;
