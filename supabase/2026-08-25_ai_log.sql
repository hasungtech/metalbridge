-- AI 계측 로그 (AI 로드맵 0.5단계)
--
-- 이후 단계의 트리거가 전부 지표인데 지표를 잴 로그가 없었습니다.
-- 상담 질문·폴백 여부, 텍스트 판독 성패, 문답 중도 이탈을 기록합니다.
--
-- 실행 순서: schema.sql → 2026-08-22_harden_anon_insert.sql
--            → 2026-08-22_consent.sql → 2026-08-23_quote_fields.sql → 이 파일
-- 여러 번 실행해도 안전합니다.

create table if not exists public.ai_log (
  id         uuid primary key,                 -- 클라이언트 생성 (RETURNING 금지 규칙)
  kind       text not null,                    -- ask · parse_ok · parse_fail · qa_drop
  q          text,                             -- 질문 원문 · 판독 실패 원문 · 이탈 문항
  hit        text,                             -- 매칭 카드 id · 판독 요약 · 진행 위치
  lang       text,
  created_at timestamptz not null default now()
);

alter table public.ai_log enable row level security;

-- 익명 키는 번들에 노출됩니다 — with check (true) 금지, 값·길이 상한 필수
drop policy if exists "anon insert ai_log" on public.ai_log;
create policy "anon insert ai_log"
  on public.ai_log for insert to anon
  with check (
    kind in ('ask','parse_ok','parse_fail','qa_drop') and
    length(coalesce(q,''))    <= 500 and
    length(coalesce(hit,''))  <= 80  and
    length(coalesce(lang,'')) <= 5
  );

drop policy if exists "staff read ai_log" on public.ai_log;
create policy "staff read ai_log"
  on public.ai_log for select to authenticated
  using (true);

grant insert on public.ai_log to anon;
grant select on public.ai_log to authenticated;
