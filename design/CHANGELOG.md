# 디자인 변경 기록

형식: `날짜 · 무엇을 · 왜 · 영향 범위`

## 2026-08-22 · 약관·처리방침 페이지 · 개인정보 동의
리전 확인 결과 Supabase `ap-northeast-2`(서울) · Vercel `icn1`(서울).
**개인정보 본체는 국외로 나가지 않습니다.** 접속 기록만 국외 이전 항목으로 보수적으로 기재했습니다.

- `privacy.html` · `terms.html` 신설 (Vite 진입점 4개로 확장)
  - 처리방침 12개 절 — 수집 항목·목적·보유 3년·제3자 제공·위탁·국외 이전·파기·권리·
    안전성 조치·쿠키·책임자·변경
  - 이용약관 12개 조 + 사업자 정보 — 제7조를 `#nda` 앵커로 두어 푸터의 비밀유지 정책이 가리킵니다
  - **실제 코드 기준으로 작성**: 공급처 요청서에 연락처가 없다는 점, 인도 장소는 포함된다는 점,
    RLS·비공개 버킷·서명 URL·업로드 제한·비밀번호 미보관을 안전성 조치에 명시
  - 확정 안 된 값은 `.todo` 로 표시 (15곳) — 회사 정보가 나오면 채웁니다
- 푸터 빈 링크(`href="#"`) 3개를 실제 페이지로 연결
- **동의 체크박스 2개** — 필수(수집·이용) + 선택(마케팅)
  - 미동의 시 전송·업로드 모두 차단하고 체크박스를 강조
  - `rfq.agreed_at` · `rfq.marketing_opt_in` 컬럼 추가
  - **RLS 로 DB 수준 강제** — `agreed_at is null` 이면 접수 거부. 미래 시각 위조도 차단
    (`supabase/2026-08-22_consent.sql`)
  - `rfq_board` 뷰에 동의 여부 노출
- 회귀 테스트에 동의 절차 반영 + `동의 없이는 접수되지 않는다` 케이스 추가 (4건)
- 영향: privacy.html · terms.html · src/legal/* · index.html · base.css · chat.js ·
  submit.js · vite.config.js · supabase/*.sql · tests · CLAUDE.md
- 확인(로컬 PG16): SQL 3종 오류 0 · 동의 없이 접수 거부 · 동의 후 접수 성공 ·
  미래 시각 위조 거부 · 담당자 화면에 동의 여부 표시
- 확인(브라우저): 미동의 전송 차단 · 미동의 업로드 판독 0건 · 동의 후 20건 · 약관 2쪽 정상

## 2026-08-22 · 백오피스 `/admin` 신설 (TASKS 1번)
문의는 DB 에 쌓이는데 볼 화면이 없었습니다. Vite 다중 진입점으로 별도 페이지를 만듭니다.

- `admin.html` + `src/admin/{main,detail}.js` + `src/admin/admin.css`
- **매직링크 로그인** (`signInWithOtp`) — 비밀번호를 저장하지 않습니다
- 요청 목록 — `rfq_board` 뷰 · 상태 필터 7종 + 전체 · 접수번호/연락처/고객사 검색 · 최신순 300건
- 상세 — 접수 정보 · 첨부 다운로드(서명 URL 60초) · 품목 명세 · 확인 문답 · 발송 후보 공급처
- 상태 변경 — 접수 → 확인중 → 발송준비 → 발송 → 회신취합 → 고객회신 → 종료
- 공급처 회신 입력 — `unit_price` · `lead_time` 저장 시 `replied_at` 자동 기록
- 번들 분리 — 백오피스는 admin(8KB) + supabase(220KB) 만 받습니다.
  xlsx(424KB) · pdf(391KB) · main(1,165KB) 은 받지 않습니다
- `noindex, nofollow` 지정
- 부수 수정: `[hidden]{display:none !important}` — `.btn{display:inline-flex}` 가
  기본 `[hidden]` 을 이겨 로그인 화면에 로그아웃 버튼이 보이던 문제
- 영향: admin.html · src/admin/* · vite.config.js · base.css · CLAUDE.md
- 확인: 로그인 전 목록 미표시·행 0건 · 로그인 후 목록/필터/상세 렌더링
  (첨부 1 · 품목 2 · 문답 1 · 공급처 2, 태그 `확정`/`확인 필요`) · 공개 페이지 영향 없음 ·
  npm test 3건 통과

## 2026-08-22 · 보안 강화 — 공급처 목록 유출 차단 · 익명 접수 조건화
### 공급처 목록이 고객에게 나가고 있었습니다
`요청서 내려받기` 는 **고객이 누르는 버튼**인데, 그 엑셀 시트 ② 에 매칭된 공급처가
이름·적합도·MOQ·리드타임·비고까지 통째로 들어 있었습니다.
CLAUDE.md 의 "공급처 목록이 공개되면 안 됩니다" 규칙 위반입니다.

- `export-rfq.js` 를 수신자별 셋으로 분리
  `exportRfq()` 고객 — ①③④ / `exportRfqSupplier()` 공급처 — ① / `exportRfqInternal()` 담당자 — 전부
- 웹 버튼은 고객용을 부릅니다. 확인 결과 고객 파일 시트가 3개로 줄고 ② 가 빠졌습니다
- 시트 ② 의 "48시간 내 회신" 문구 제거 — 검증되지 않은 수치 (문구 규칙)

### 익명 insert 가 무조건이었습니다
익명 키는 번들에 노출되므로 RLS 가 유일한 방어선인데 `with check (true)` 였습니다.

- `supabase/2026-08-22_harden_anon_insert.sql` 신설
  - 5개 테이블에 길이·개수 상한 CHECK 제약
  - `rfq` 익명 insert 조건: `status='접수'` · 접수번호 형식 · `source='web'` · `memo is null`
  - 나머지 4개 테이블은 `rfq_exists()` (security definer) 로 실존 `rfq_id` 강제
  - Storage 버킷 `file_size_limit` 50MB + `allowed_mime_types` 지정
  - 업로드 경로를 `MB-YYMMDD-NNN/` 으로 제한
- `submit.js` — `status` 를 `'접수'` 로 고정 (기존엔 클라이언트가 `확인중`/`발송준비` 를 직접 지정).
  진행 상태는 담당자 몫입니다. 파일명 `safeName()` 정규화 추가
- `schema.sql` 동기화 (단일 출처)
- CLAUDE.md 에 DB·엑셀 규칙 추가
- 영향: engine/export-rfq.js · engine/submit.js · supabase/*.sql · CLAUDE.md
- 확인: 고객 파일 시트 `① ③ ④` — 공급처 목록 없음 · npm test 3건 통과

### SQL 을 실제 Postgres 16 에 돌려 검증하다 버그 3건을 잡았습니다
- **`qty` 제약이 틀림** — `rfq_items.qty` 는 integer 인데 `length(coalesce(qty,''))` 로
  text 취급 → 마이그레이션 자체가 실패. 정수 범위 검사로 수정
- **`INSERT ... RETURNING` 이 원래부터 실패하던 문제** — `submit.js` 의
  `.insert().select('id')` 는 SELECT 권한과 **SELECT 정책**을 둘 다 요구합니다.
  익명에게 SELECT 정책이 없으므로 이 경로는 처음부터 동작하지 않았고,
  모든 접수가 `catch` 로 빠져 메일 폴백으로 갔을 것입니다.
  → 익명에게 조회를 열지 않기 위해 **id 를 클라이언트에서 만들어** 되돌려받지 않도록 변경
- **`authenticated` grant 누락** — Supabase 기본 grant 에 의존하고 있었습니다. 명시적으로 부여

검증(로컬 PG16, Supabase 역할·storage 스키마 흉내):
```
schema.sql → 마이그레이션 → 재실행       오류 0
익명 접수 5개 테이블 전부                 성공
익명: rfq · rfq_board · suppliers 조회    전부 거부
익명: 상태 임의지정 · 접수번호 형식 위반 · memo 쓰기 ·
      2000자 초과 · 없는 rfq_id           전부 거부
담당자: rfq_board 조회                    정상
버킷: public=false · 50MB · MIME 17종
```

## 2026-08-22 · 브랜드 소개 화면을 첫 화면으로 (v4 TF 1번 되돌림)
운영자 요청으로 문의창 앞에 브랜드 소개 화면을 둡니다.
v4 TF 검토 1번("설명 섹션 전부 삭제, 첫 화면을 문의창 자체로")과 반대 방향이라,
**설명은 한 화면으로만** 두고 `문의하기` 를 크게 놓아 바로 건너뛸 수 있게 절충했습니다.

- `#intro` 신설 — **2열 배치**: 좌측 카피(아이브로·H1·리드·CTA·사실 2줄), 우측 "저희가 대신하는 일" 4행
- 문구는 **문제 먼저**. H1 `여러 곳에 전화 돌리는 일, / 저희가 대신 합니다`
- 리드는 한 문장으로 압축. 대신하는 일 4행은 라벨 + 한 줄 설명만
  (사양 정리 / 결손 확인 / 동시 발송 / 비교표 회신)
- 소개 화면 높이 900px → **510px** (뷰포트 900 기준), H1 2줄 고정
- 검증되지 않은 수치·홍보 문구 없음. 단가는 공급처가 낸다는 원칙을 첫 화면에 명시
- 지구본 라벨이 화면 밖일 때 좌표가 얼어 리사이즈 시 가로 스크롤(532px)을 만들던 버그 수정
  `.globe-stage{overflow:hidden}` + resize 시 한 프레임 강제 갱신
- 상단 바에 `문의하기` 버튼 상시 노출 (`#barAsk`) — 어느 위치에서든 문의창으로
- `#introAsk` · `#barAsk` · `#ctaUpload` · `#fabCta` 모두 `toDesk()` 로 통일
- 접수번호는 발급 후에만 표시 (소개 화면에서 "미발급" 이 뜨지 않도록)
- `scroll-margin-top` 으로 스티키 상단 바(64/52px) 아래에 정확히 정렬
- `focus({preventScroll:true})` — 포커스가 스크롤을 다시 잡아 101px 로 어긋나던 것을 수정
- 영향: index.html · base.css · misc.js
- 확인: 첫 섹션 #intro · 문의하기 클릭 시 desk.top = 상단 바 높이(64) · #askIn 포커스 ·
  모바일 390 가로 넘침 없음(문의하기 버튼 y=444/844, 높이 53px) · npm test 3건 통과

## 2026-08-22 · 회귀 테스트 복구 · 문서 정합화
- `npm test` 가 실제로 돌게 고쳤습니다. 세션 내내 실행 불가였던 원인 두 가지를 각각 처리:
  1. 브라우저 빌드 불일치 → `playwright.config.js` 에 `PW_CHROMIUM_PATH` 환경변수 지원
  2. `setInputFiles` 가 조용히 실패 → 첨부 결과를 확인해 0건이면 DataTransfer 로 주입하는
     `attachSample()` 헬퍼. **기대값(품목 20건 · 확정 1x · DOM 훅 7개)은 그대로**입니다
- 판독 결과가 표 → 카드로 바뀐 것을 테스트에 반영 (`#specBody .card` 20건, `.abub.sys` 확인)
- `netlify.toml` 삭제 — 호스팅은 Vercel 로 확정됐고 설정이 중복이었습니다
- `CLAUDE.md` 에 v4 화면 구성 절 추가 (화면 3개 · 3D 라이브러리 미사용 · 지리 데이터 위치 ·
  결손 사유는 diagnose() 출력 사용 · 불가→확인 필요 표시 규칙) + 테스트 실행 안내
- `CLAUDE.md` · `README.md` · `design/TASKS.md` 의 "섹션 11개 → 5개" 항목을 v4 완료로 갱신
- `design/HANDOFF_DESIGN.md` 상단에 v1 문서임을 알리는 안내 추가
- 남은 일에 로고 선정 · 회사 정보 2건 명시
- 영향: playwright.config.js · tests/regression.spec.js · 문서 4개 · netlify.toml 삭제
- 확인: `npm test` **3건 전부 통과** (이 컨테이너에서 실제 실행)

## 2026-08-22 · v4 TF 검토 11건 대조 — 누락분 4건 보강
v4 시안의 TF REVIEW 11건을 구현과 하나씩 대조했습니다. 7건은 이미 반영, 4건이 빠져 있었습니다.

- TF 3 (상단 바 상태 상시 노출) — 점 색이 상태를 따라가지 않던 것을 수정
  대기 --stone / 드래그·판독·문답 --molten(점멸) / 판독 완료·발송 --success
- TF 3 — 상단 바에 `확정 N건 발송 대상` 추가 (시안 표기)
- TF 4 (모바일 터치 최소 44px) — 칩·버튼이 약 33px 이던 것을 44px 로.
  대상: .askchips button · .fchip · .askinput .go · .askinput .ic · .btn
- 지구본 오버레이 `SUPPLY ROUTES` · `ORTHOGRAPHIC · LON nnn` (경도 실시간 표시)
- 화면 2 하단 3줄에 01/02/03 번호, 모바일에서 `요청서 내려받기` 풀폭 버튼 노출
- 영향: index.html · base.css · misc.js · scene3d.js · spec-table.js
- 확인: 상태 점 전이 3단계(회색→파랑→초록) · 모바일 44px 미만 터치 요소 0건 ·
  경도 표시 동작 · JS 에러 0건

## 2026-08-22 · v4 재설계 — 5섹션 랜딩 → 3화면 작업 도구
`design_handoff_v4/README.md` 기준. v1 인수 문서를 대체합니다.

- 화면 1 전체화면 문의창 (`100vh − 64px`): 상단 바(로고·접수번호·상태) +
  `1fr 560px` — 좌 드롭/대화/완료 블록/입력, 우 판독 결과 레일
- 화면 2 거래 흐름: 실제 지리 데이터 지구본 + 권역 4행 (호버 시 해당 경로만 강조)
- 화면 3 회사 소개: 정의문 + 고객 정의 + 원칙 3개 + CTA
- 삭제: 5섹션 랜딩 구조 · FAQ · SPECIFICATION 카드 · 4열 공급망 그리드 · 히어로 전용 입력

**판독 레일 (가장 크게 바뀐 부분)**
- 표 → 품목 카드. 1행 번호·재질·`문답으로 확정`·상태 알약 / 2행 `0.75fr 1.55fr 0.7fr`
  형상·치수·수량 / 3행 확인 항목 칩 / 4행 원문 한 줄
- 상태 필터 칩 4개 (전체·확정·조건부·확인 필요). 선택 시 --cloud 면 + --charcoal 테두리
- 결손 사유 문구는 engine/parse.js 의 diagnose() 출력을 그대로 사용
- 길이 답변이 구체적 치수면 치수 칸에 합쳐 표시 (정척 6m → × 6,000)

**지구본**
- three.js 제거 → Canvas 2D 정사영. 번들에서 three 청크 513KB 감소
- Natural Earth countries-110m (world-atlas, ISC) 를 topojson.mesh() 로 해안선·국경화.
  `public/geo/` 에 두고 같은 출처에서 지연 로드 — 외부 네트워크 의존 없음
- 점을 단위 벡터로 미리 변환해 두고 프레임마다 회전 행렬만 적용
- 자동 회전 경도 86~132° 왕복, 드래그는 제한 없음(손 떼면 범위 복귀)
- 라벨은 HTML 오버레이, 노드마다 방향이 달라 부산·오사카가 겹치지 않음
- 대권 경로 3개 + 경로를 따라 흐르는 점

**미결 결정**
- `.tag.warn`(조건부) = `--mute` 로 확정 (2026-08-22 인터뷰). `--amber` 미사용
- 로고 10안 선정 · 회사 소재지/설립/사업자번호는 아직 미정 — 푸터 미반영

- 영향: index.html 전면 · base.css 전면 · spec-table.js 전면 · scene3d.js 전면 ·
  misc.js · chat.js · main.js · state.js(S.filter 1개 추가) · package.json
- 확인: 카드 20건 · 문답 후 확정 19 · `문답으로 확정` 5건 · 접수번호 발급 ·
  상단 상태 전이 · 지구본 네 도시 라벨 모두 표시 · DOM 훅 7개 · JS 에러 0건 ·
  모바일 390 가로 넘침 없음(업로드 버튼 y=202/844)

## 2026-08-22 · 메인 재설계 4·5단계 — 히어로 상태 파생 · 완료 블록
- 히어로 5개 상태를 S 에서 파생 (`misc.js`의 `syncHero()`). S 에 화면 전용 필드 추가 없음
  | 상태 | 글리프 | 제목 | 테두리 |
  |---|---|---|---|
  | 1 업로드 전 | + | 여기에 도면·BOM을 놓으십시오 | --charcoal |
  | 1b 드래그 | ↓ | 놓으면 바로 판독합니다 | --molten |
  | 2 판독 중 | ◐ | 자료를 읽고 있습니다 | --hairline |
  | 3 판독 완료 | ✓ | 판독을 마쳤습니다 | --hairline |
  | 4 문답 중 | ✓ | 판독을 마쳤습니다 · n / N | --hairline |
  | 5 완료 | ✓ | 요청서가 준비되었습니다 | --hairline |
- 업로드 영역을 더는 숨기지 않습니다 (`hideDrop()` 제거) — 상태만 바뀝니다
- 완료 블록 `#doneBox` 동작 연결: 접수번호 · 전달 상태 · 요청서 내려받기 · 담당자에게 보내기
  전달 전에는 --mute 점, 접수 성공 시 --success 점으로 전환
- `#sendStaff` id 중복 해소 — chat.js 말풍선 안의 버튼 2개를 제거하고 완료 블록으로 일원화
- 판독표 원문 열 제거 (7열 → 6열, v2 명세). 원문은 엑셀 요청서에 그대로 남습니다
- 모바일 CSS 의 `.spec td:last-child{display:none}` 제거 — 원문 열이 사라져 판독 태그가 숨겨지던 문제
- 영향: misc.js · chat.js · spec-table.js · main.js · base.css
- 확인: 5개 상태 전이 전수 · 품목 20건 · 문답 후 확정 19 · 접수번호 형식 · 판독표 6열 ·
  모바일에서 판독 태그 보임 · JS 에러 0건

## 2026-08-22 · 메인 재설계 2단계 — base.css 를 새 레이아웃에 맞춤
v2 캔버스 실측값 기준. base.css 388줄 → 300줄. 하드코딩 색 0건(#fff 관례 제외).

- 히어로: 검은 면 → --canvas. 그리드 1fr 380px, 3D 오브젝트 620×620 우상단 opacity .55
- 업로드 영역: 2px dashed, 56px 글리프 + 26px 제목 + 파란 알약 `파일 선택`, 하단에 직접 입력 줄
- SPECIFICATION 카드: 1px 헤어라인, 헤더 mono 11px, 항목 4개 헤어라인 구분
- 판독표: 헤더 --cloud + mono 11px, 셀 16px, 치수·수량 mono 14px, 태그 아웃라인 3색
- 확인 문답: 1fr 1fr, CONVERSATION LOG 패널(min-height 420px), 말풍선 max-width 78%
- 공급망: --cloud 면에 4열 그리드(v2 기준 — 어두운 반전 아님)
- 마무리: 1fr 1fr, CTA 2개 + FAQ 3개 카드
- 내비 72px / 푸터 슬림 / 떠 있는 상담 버튼 아웃라인 알약
- 반응형 1024(2열→1열) · 768(공급망 1열, 표→카드, 내비 52px) · 560(3D 숨김)
- 삭제된 섹션의 죽은 CSS 제거: trustbar · console · panel · sample · bo · globe · netlist ·
  viewer · steps · chips · fcols · utility · askcard · hero-facts 등
- spec-table.js 빈 상태 문구를 명세에 맞춤 + 빈 상태 요약 문구 표시
- 영향: base.css 전면 · spec-table.js 빈 상태
- 확인: 품목 20건 · 문답 후 확정 19 · DOM 훅 7개 · JS 에러 0건 ·
  모바일 390 가로 넘침 없음 · 업로드 버튼 첫 화면 안(y=419/844)

## 2026-08-22 · 메인 재설계 1단계 — 섹션 11개 → 5개
기준 문서: `design_handoff_main_page` 의 **v2 캔버스**.
README.md 는 v1(어두운 면 26곳) 기준이라 v2 와 충돌하며, v2 = v1 + 검은 면 제거임을 확인하고 v2 를 따랐습니다.

- 섹션 구성: ① 히어로(업로드) ② 판독 결과 ③ 확인 문답 ④ 공급망 ⑤ 마무리(CTA+FAQ)
- 삭제: trustbar · 누가 쓰나 · 작동 방식 · 진행 현황 · AI 상담 섹션 · 취급 소재 3D 뷰어 · 상단 유틸리티 바 · 5열 푸터
- 판독 예시 데모(샘플 패널)를 없애고 실제 업로드 결과가 그 자리를 채우도록 통합
- 내비: 링크 6개 → 3개(판독·공급망·문의) + `견적 요청` 버튼
- 푸터: 저작권 + 이용약관·개인정보처리방침·비밀유지 정책 링크만 남긴 슬림 푸터
- 히어로에 직접 입력(#heroIn·#heroSend) 신설 — 파일 없는 방문자용, submit() 동일 진입점
- 완료 블록(#doneBox) 마크업 선반영 (동작 연결은 5단계)
- scene3d.js 245줄 → 129줄. 소재 뷰어·지구본 3D 제거, 히어로 오브젝트 1개만 남김
  (1단계만 하면 삭제된 캔버스를 참조해 3D 전체가 죽으므로 3단계를 함께 반영)
- misc.js 정리: 진행 현황 데모·섹션 내 상담 UI 제거. 지식베이스와 떠 있는 상담창은 유지
- 남은 var(--ink) 인라인 2곳(chat.js)을 --charcoal 로 정리
- 영향: index.html 전면 · scene3d.js · misc.js · chat.js. **CSS(2단계)는 아직 없음**
- 유지 확인: DOM 훅 7개 · .abub.sys · 품목 20건 · 문답 후 확정 19 · JS 에러 0건 · 모바일 390 가로 넘침 없음

## 2026-08-22 · 상태 태그·그림자 정리 (디자인 확인 반영)
- 상태 태그를 v2 캔버스대로 아웃라인 3색으로 전환
  확정 --success · 조건부 --hairline/--mute · 확인 필요 --molten (채움 → 1px 테두리)
  하드코딩 #e6f4ee·#fff1dd·#a5670a·#ffe9e3·#c2350a 제거
- .fab · .aiwin 의 box-shadow 제거. 구분은 1px 헤어라인 (상단 바의 inset 헤어라인은 유지)
- .state.review 가 어두운 면 전제(밝은 초록 글자)로 남아 있던 것을 --success 로 보정 (현재 미사용)
- #edf5ff 2곳을 값이 같은 --blue-tint 로 치환 (시각 변화 없음)
- 판독표 태그 라벨 '불가' → '확인 필요' 로 요약 문구와 통일 (표시만, 엔진 상태값은 '불가' 유지)
- 확인 결과 hero · globe-sec 는 3D 대비를 위해 검은 면으로 유지
- 영향: base.css · ui/spec-table.js. 토큰 값 변경 없음, 엔진 변경 없음

## 2026-08-22 · 검은 면 제거
- 어두운 면(trustbar · panel.dark · bo · cta · aiwin 헤더)을 --cloud 밝은 면으로 전환
- 주 텍스트·테두리 --ink → --charcoal, 검은 채움 버튼 → --molten
- 고객 말풍선 --ink → --blue-tint + --blue-hi 테두리, 시스템 말풍선은 흰 면
- 밝아진 면 위에서 읽히지 않던 자식 규칙을 함께 보정
  (어두운 헤어라인 #2a2a2d·#26262a·#34343a → --hairline,
   흐린 회색 텍스트 #a9adb1·#c9c9cb·--stone → --mute,
   .btn-ghost 흰 테두리 → --charcoal, aiwin 닫기 버튼 흰색 → --charcoal,
   .bo 제목의 인라인 흰색 제거, #who 카드 하나만 검던 인라인 배경 제거)
- .msg.me 를 --blue-tint 로 맞춰 .msg.sys 와 좌우 구분 유지
- hero · globe-sec 는 목록에 없어 검은 면으로 남김
- 영향: base.css 전역 · index.html 인라인 색상. 토큰 값 변경 없음

## 2026-08-22 · 인프라 이관
- Netlify 제거, Vercel + Supabase 구성으로 전환
- 문의 접수를 Netlify Forms → Supabase 테이블로 이관
- 영향: 전송 로직(`src/engine/submit.js`), 배포 설정

## 2026-08-22 · 모듈 분리
- 단일 HTML(3MB) → Vite 모듈 구조
- 디자인 토큰을 `src/styles/tokens.css` 로 추출
- 핵심 컬러 IBM Blue 60(#0f62fe) 통일
- 영향: 전 화면

## (예정) 메인 페이지 재설계
- 섹션 11개 → 5개, 3D 3개 → 1개, 업로드를 첫 화면 주인공으로
- 착수 조건: 월 문의 15건 이상
- 영향: index.html · base.css · ui/chat.js 마운트 지점
