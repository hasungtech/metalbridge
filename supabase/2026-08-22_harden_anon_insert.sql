-- ═══════════════════════════════════════════════════════════
--  2026-08-22 · 익명 접수 경로 강화
--
--  VITE_SUPABASE_ANON_KEY 는 브라우저 번들에 그대로 들어갑니다.
--  따라서 RLS 와 테이블 제약이 유일한 방어선인데, 기존 정책은
--  with check (true) 라 아무 조건이 없었습니다.
--
--  Supabase → SQL Editor 에 그대로 붙여 실행하십시오. 재실행 가능합니다.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 길이·개수 상한 (익명·담당자 모두에게 적용)
alter table public.rfq        drop constraint if exists rfq_len_guard;
alter table public.rfq        add  constraint rfq_len_guard check (
  length(rfq_no)  <= 32  and
  length(coalesce(contact,'')) <= 200 and
  length(coalesce(company,'')) <= 200 and
  length(coalesce(due,''))     <= 200 and
  length(coalesce(place,''))   <= 300 and
  length(coalesce(mtc,''))     <= 200 and
  length(coalesce(extra,''))   <= 2000 and
  length(coalesce(memo,''))    <= 2000 and
  item_count between 0 and 500 and
  sendable  between 0 and 500
);

alter table public.rfq_items  drop constraint if exists rfq_items_len_guard;
alter table public.rfq_items  add  constraint rfq_items_len_guard check (
  no between 0 and 500 and
  length(coalesce(grade,''))    <= 200 and
  length(coalesce(category,'')) <= 60  and
  length(coalesce(shape,''))    <= 60  and
  length(coalesce(dim,''))      <= 200 and
  length(coalesce(qty,''))      <= 60  and
  length(coalesce(state,''))    <= 20  and
  length(coalesce(issues,''))   <= 500 and
  length(coalesce(raw,''))      <= 2000
);

alter table public.rfq_answers drop constraint if exists rfq_answers_len_guard;
alter table public.rfq_answers add  constraint rfq_answers_len_guard check (
  seq between 0 and 100 and
  length(coalesce(label,''))    <= 100  and
  length(coalesce(question,'')) <= 1000 and
  length(coalesce(answer,''))   <= 1000 and
  length(coalesce(rows,''))     <= 500
);

alter table public.rfq_suppliers drop constraint if exists rfq_suppliers_len_guard;
alter table public.rfq_suppliers add  constraint rfq_suppliers_len_guard check (
  length(coalesce(supplier_name,'')) <= 200 and
  length(coalesce(items,''))         <= 1000 and
  length(coalesce(batch,''))         <= 20  and
  score between 0 and 100
);

alter table public.rfq_files  drop constraint if exists rfq_files_len_guard;
alter table public.rfq_files  add  constraint rfq_files_len_guard check (
  length(path)      <= 500 and
  length(file_name) <= 300 and
  size between 0 and 52428800          -- 50MB
);

-- ── 2. 익명 insert 조건 강화 (기존 with check (true) 교체)
drop policy if exists "anon insert rfq" on public.rfq;
create policy "anon insert rfq" on public.rfq
  for insert to anon with check (
    -- 접수 상태만 만들 수 있습니다. 진행 상태는 담당자만 바꿉니다
    status = '접수'
    -- 발급 형식을 벗어난 접수번호를 막습니다 (MB-YYMMDD-NNN)
    and rfq_no ~ '^MB-[0-9]{6}-[0-9]{3}$'
    and source = 'web'
    and memo is null                     -- 담당자 메모 칸을 익명이 채우지 못하게
  );

-- 나머지 테이블은 반드시 실존하는 rfq 에 매달리게 합니다.
-- rfq.id 는 uuid 라 추측이 불가능하므로, 자기가 방금 만든 건에만 붙일 수 있습니다.
create or replace function public.rfq_exists(p uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.rfq where id = p);
$$;
revoke all on function public.rfq_exists(uuid) from public;
grant execute on function public.rfq_exists(uuid) to anon, authenticated;

drop policy if exists "anon insert rfq_items" on public.rfq_items;
create policy "anon insert rfq_items" on public.rfq_items
  for insert to anon with check (public.rfq_exists(rfq_id));

drop policy if exists "anon insert rfq_answers" on public.rfq_answers;
create policy "anon insert rfq_answers" on public.rfq_answers
  for insert to anon with check (public.rfq_exists(rfq_id));

drop policy if exists "anon insert rfq_suppliers" on public.rfq_suppliers;
create policy "anon insert rfq_suppliers" on public.rfq_suppliers
  for insert to anon with check (public.rfq_exists(rfq_id));

drop policy if exists "anon insert rfq_files" on public.rfq_files;
create policy "anon insert rfq_files" on public.rfq_files
  for insert to anon with check (public.rfq_exists(rfq_id));

-- ── 3. Storage 버킷 — 크기·형식 제한
--     기존 버킷이 이미 있으므로 update 로 걸어야 합니다.
update storage.buckets set
  public = false,
  file_size_limit = 52428800,            -- 50MB
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv','text/plain',
    'image/jpeg','image/png','image/webp',
    'application/zip','application/x-zip-compressed',
    'image/vnd.dwg','application/acad','application/dxf','image/vnd.dxf',
    'model/step','application/step','application/octet-stream'
  ]
where id = 'rfq-files';

-- 업로드 경로를 접수번호 폴더로 제한합니다 (다른 경로에 못 쓰게)
drop policy if exists "anon upload rfq files" on storage.objects;
create policy "anon upload rfq files"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'rfq-files'
    and name ~ '^MB-[0-9]{6}-[0-9]{3}/'
  );

-- ── 4. 확인
--   select * from pg_policies where schemaname in ('public','storage');
--   select id, public, file_size_limit from storage.buckets where id='rfq-files';

-- ── 5. rfq_board 뷰 — RLS 우회 차단
--
--  Postgres 뷰는 기본적으로 "뷰 소유자" 권한으로 하위 테이블을 읽습니다.
--  그래서 rfq 에 익명 select 정책이 없어도, 뷰를 통하면 전체가 보일 수 있습니다.
--  (Supabase 린터의 security_definer_view 경고)
--
--  두 겹으로 막습니다: 호출자 권한으로 실행 + 익명 권한 회수.
alter view public.rfq_board set (security_invoker = on);

revoke all on public.rfq_board from anon;
grant select on public.rfq_board to authenticated;

-- 테이블 자체도 익명 select 권한이 남아 있지 않은지 확인합니다.
revoke select on public.rfq, public.rfq_items, public.rfq_answers,
                 public.rfq_suppliers, public.rfq_files, public.suppliers from anon;
grant  insert on public.rfq, public.rfq_items, public.rfq_answers,
                 public.rfq_suppliers, public.rfq_files to anon;

-- ── 6. 확인
--   select table_name, privilege_type from information_schema.role_table_grants
--    where grantee='anon' and table_schema='public';
--   -- INSERT 만 남아야 합니다. SELECT 가 보이면 위 revoke 를 다시 실행하십시오.
