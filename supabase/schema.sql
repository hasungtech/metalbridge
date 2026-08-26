-- ═══════════════════════════════════════════════════════════
--  METAL BRIDGE · Supabase 스키마
--  Supabase → SQL Editor 에 그대로 붙여 실행하십시오.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 견적 요청 (헤더)
create table if not exists public.rfq (
  id            uuid primary key default gen_random_uuid(),
  rfq_no        text unique not null,              -- MB-260822-137
  created_at    timestamptz not null default now(),
  status        text not null default '접수',       -- 접수·확인중·발송준비·발송·회신취합·고객회신·종료
  contact       text,                              -- 연락처
  company       text,                              -- 고객사 (선택)
  due           text,                              -- 희망 납기
  place         text,                              -- 인도 장소
  mtc           text,                              -- 성적서 요구 (등급 포함)
  -- 견적 조건 — 공급처가 되묻지 않도록 문답에서 받아 넘깁니다
  usage         text,                              -- 용도
  finish        text,                              -- 표면·마감
  heat          text,                              -- 열처리·조질
  fab           text,                              -- 가공 범위
  tol           text,                              -- 공차
  origin        text,                              -- 원산지 제한
  incoterm      text,                              -- 인도 조건
  order_type    text,                              -- 발주 형태 (1회 · 정기)
  extra         text,                              -- 추가 요청
  item_count    int  not null default 0,
  sendable      int  not null default 0,           -- 발송 가능 건수
  source        text not null default 'web',
  memo          text,                              -- 담당자 메모
  agreed_at     timestamptz,                       -- 개인정보 수집·이용 필수 동의 시각
  marketing_opt_in boolean not null default false  -- 마케팅 수신 선택 동의
);

-- ── 2. 품목 명세
create table if not exists public.rfq_items (
  id          bigserial primary key,
  rfq_id      uuid not null references public.rfq(id) on delete cascade,
  no          int  not null,
  grade       text,        -- 재질 (STS316L 등)
  category    text,        -- 소재 구분 (스테인리스·알루미늄 등)
  shape       text,        -- 형상
  dim         text,        -- 치수
  qty         int,
  unit        text,        -- 장 · 본 · kg · 톤
  state       text,        -- 확정 · 조건부 · 불가
  issues      text,        -- 확인 필요 사항
  raw         text         -- 원문
);
create index if not exists rfq_items_rfq_id_idx on public.rfq_items(rfq_id);

-- ── 3. 확인 문답
create table if not exists public.rfq_answers (
  id        bigserial primary key,
  rfq_id    uuid not null references public.rfq(id) on delete cascade,
  seq       int,
  label     text,     -- 연락처 · 치수 열 정의 · 길이 …
  question  text,
  answer    text,
  rows      text      -- 적용 품목 번호 "10, 11, 12"
);
create index if not exists rfq_answers_rfq_id_idx on public.rfq_answers(rfq_id);

-- ── 4. 공급처 마스터 (담당자가 직접 관리)
create table if not exists public.suppliers (
  id          bigserial primary key,
  active      boolean not null default true,
  country     text not null,
  region      text,
  type        text,                 -- 제철소 · 유통 · 상사 · 스토키스트
  name        text not null,
  categories  text[] not null,      -- {스테인리스, 알루미늄}
  shapes      text[],               -- {판재, 환봉}
  moq         text,
  lead_time   text,
  priority    int default 3,        -- 1~3
  status      text default '후보',   -- 후보 · 거래중 · 중단
  contact     text,
  email       text,
  note        text
);

-- ── 5. 발송·회신 추적
create table if not exists public.rfq_suppliers (
  id           bigserial primary key,
  rfq_id       uuid not null references public.rfq(id) on delete cascade,
  supplier_id  bigint references public.suppliers(id),
  supplier_name text,               -- 마스터 미등록 공급처 대비
  score        int,                 -- 적합도 %
  items        text,                -- 대응 품목 번호
  batch        text,                -- 1차 · 2차
  sent_at      timestamptz,
  replied_at   timestamptz,
  unit_price   text,
  lead_time    text,
  note         text
);
create index if not exists rfq_suppliers_rfq_id_idx on public.rfq_suppliers(rfq_id);

-- ── 6. 첨부 파일
create table if not exists public.rfq_files (
  id         bigserial primary key,
  rfq_id     uuid not null references public.rfq(id) on delete cascade,
  path       text not null,         -- storage 경로
  file_name  text,
  size       bigint,
  kind       text default '고객자료'  -- 고객자료 · 생성요청서
);

-- ═══════════════════════════════════════════════════════════
--  RLS — 익명은 접수만, 조회는 로그인한 담당자만
-- ═══════════════════════════════════════════════════════════
alter table public.rfq           enable row level security;
alter table public.rfq_items     enable row level security;
alter table public.rfq_answers   enable row level security;
alter table public.rfq_suppliers enable row level security;
alter table public.rfq_files     enable row level security;
alter table public.suppliers     enable row level security;

-- 익명 접수 허용 (insert only)
-- 익명 키는 브라우저에 노출됩니다. RLS 가 유일한 방어선이므로 조건을 답니다.
-- 상세 조건과 길이 제약은 2026-08-22_harden_anon_insert.sql 참조.
create or replace function public.rfq_exists(p uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.rfq where id = p);
$$;
revoke all on function public.rfq_exists(uuid) from public;
grant execute on function public.rfq_exists(uuid) to anon, authenticated;

create policy "anon insert rfq" on public.rfq for insert to anon with check (
  status = '접수' and rfq_no ~ '^MB-[0-9]{6}-[0-9]{3}$' and source = 'web' and memo is null
  and agreed_at is not null                        -- 필수 동의 없이는 접수 불가
  and agreed_at <= now() + interval '5 minutes'
  and agreed_at >= now() - interval '1 day');
create policy "anon insert rfq_items"     on public.rfq_items     for insert to anon with check (public.rfq_exists(rfq_id));
create policy "anon insert rfq_answers"   on public.rfq_answers   for insert to anon with check (public.rfq_exists(rfq_id));
create policy "anon insert rfq_suppliers" on public.rfq_suppliers for insert to anon with check (public.rfq_exists(rfq_id));
create policy "anon insert rfq_files"     on public.rfq_files     for insert to anon with check (public.rfq_exists(rfq_id));

-- 담당자(로그인) 전체 권한
create policy "staff all rfq"           on public.rfq           for all to authenticated using (true) with check (true);
create policy "staff all rfq_items"     on public.rfq_items     for all to authenticated using (true) with check (true);
create policy "staff all rfq_answers"   on public.rfq_answers   for all to authenticated using (true) with check (true);
create policy "staff all rfq_suppliers" on public.rfq_suppliers for all to authenticated using (true) with check (true);
create policy "staff all rfq_files"     on public.rfq_files     for all to authenticated using (true) with check (true);
create policy "staff all suppliers"     on public.suppliers     for all to authenticated using (true) with check (true);
-- 공급처 목록은 익명에게 노출하지 않습니다 (select 정책 없음)

-- ═══════════════════════════════════════════════════════════
--  Storage — 고객 자료 업로드용 버킷
--  Dashboard → Storage → New bucket → 이름 rfq-files · Public 해제
-- ═══════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit)
values ('rfq-files', 'rfq-files', false, 52428800)   -- 50MB
on conflict (id) do nothing;

create policy "anon upload rfq files"
  on storage.objects for insert to anon
  with check (bucket_id = 'rfq-files' and name ~ '^MB-[0-9]{6}-[0-9]{3}/');

create policy "staff read rfq files"
  on storage.objects for select to authenticated
  using (bucket_id = 'rfq-files');

-- ═══════════════════════════════════════════════════════════
--  AI 계측 로그 — 로드맵 트리거 지표의 근거 (폴백률·판독 확정률·문항 이탈)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.ai_log (
  id         uuid primary key,
  kind       text not null,        -- ask · parse_ok · parse_fail · qa_drop
  q          text,
  hit        text,
  lang       text,
  created_at timestamptz not null default now()
);
alter table public.ai_log enable row level security;
create policy "anon insert ai_log"
  on public.ai_log for insert to anon
  with check (
    kind in ('ask','parse_ok','parse_fail','qa_drop') and
    length(coalesce(q,''))    <= 500 and
    length(coalesce(hit,''))  <= 80  and
    length(coalesce(lang,'')) <= 5
  );
create policy "staff read ai_log"
  on public.ai_log for select to authenticated
  using (true);
grant insert on public.ai_log to anon;
grant select on public.ai_log to authenticated;

-- ═══════════════════════════════════════════════════════════
--  백오피스 목록용 뷰
-- ═══════════════════════════════════════════════════════════
create or replace view public.rfq_board as
select
  r.id, r.rfq_no, r.created_at, r.status, r.contact, r.company,
  r.due, r.place, r.mtc, r.item_count, r.sendable,
  r.agreed_at, r.marketing_opt_in,
  r.usage, r.finish, r.heat, r.fab, r.tol, r.origin, r.incoterm, r.order_type,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id) as supplier_count,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id and s.replied_at is not null) as replied_count
from public.rfq r
order by r.created_at desc;

-- 뷰는 기본적으로 소유자 권한으로 하위 테이블을 읽어 RLS 를 우회합니다.
-- 호출자 권한으로 돌리고 익명 권한을 회수합니다.
alter view public.rfq_board set (security_invoker = on);
revoke all on public.rfq_board from anon;
grant select on public.rfq_board to authenticated;
