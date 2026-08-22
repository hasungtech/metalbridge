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
  mtc           text,                              -- 성적서 요구
  extra         text,                              -- 추가 요청
  item_count    int  not null default 0,
  sendable      int  not null default 0,           -- 발송 가능 건수
  source        text not null default 'web',
  memo          text                               -- 담당자 메모
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
  status = '접수' and rfq_no ~ '^MB-[0-9]{6}-[0-9]{3}$' and source = 'web' and memo is null);
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
--  백오피스 목록용 뷰
-- ═══════════════════════════════════════════════════════════
create or replace view public.rfq_board as
select
  r.id, r.rfq_no, r.created_at, r.status, r.contact, r.company,
  r.due, r.place, r.item_count, r.sendable,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id) as supplier_count,
  (select count(*) from public.rfq_suppliers s where s.rfq_id = r.id and s.replied_at is not null) as replied_count
from public.rfq r
order by r.created_at desc;
