# CLAUDE.md — METAL BRIDGE 작업 규칙

이 파일은 Claude Code가 매 세션 시작 시 읽습니다.
새 세션에서도 같은 규칙으로 작업되도록 여기에 결정을 누적하십시오.

---

## 프로젝트

**METAL BRIDGE (metalbridge.ai)** — 특수 소재 견적 중개 플랫폼
운영: Grit Corporation

고객사가 도면·BOM·메신저 텍스트를 올리면 브라우저에서 직접 판독해 사양서로 정리하고,
빠진 항목을 대화로 채운 뒤, 한국·중국·일본·인도 공급망에 보낼 견적요청서를 생성합니다.

## 절대 깨뜨리면 안 되는 것

### 1. DOM 훅 7개

레이아웃은 자유롭게 바꿔도 되지만 아래 id는 반드시 존재해야 합니다.

| id | 역할 |
|---|---|
| `drop` | 파일 드롭 영역 |
| `fileInput` | `<input type="file" multiple hidden>` |
| `askLog` | 대화 말풍선 컨테이너 |
| `askChips` | 선택지 버튼 줄 |
| `askIn` | 답변 입력 |
| `specBody` | 판독 결과 표 영역 |
| `specMeta` | 판독 요약 문구 |

클래스도 유지: `.abub.sys` `.abub.me` `.tag.ok` `.tag.warn` `.tag.miss`

### 2. 상태는 `src/state.js`의 `S` 하나로만

전역 변수를 새로 만들지 마십시오. 필드 추가는 `S`에만.

### 3. 엔진과 UI 분리

`src/engine/*` 는 DOM을 몰라야 합니다. 화면 조작은 `src/ui/*` 에서만.

- `engine/parse.js` — 텍스트 → 품목 판독, 결손 진단
- `engine/read-file.js` — 파일 → 텍스트 라인 (xlsx·pdf·csv·txt)
- `engine/suppliers.js` — 공급처 마스터 62곳, 소재 분류, 매칭
- `engine/export-rfq.js` — 요청서 엑셀 4시트, 담당자 전달

### 4. 회귀 테스트를 깨지 마십시오

`npm test` — 샘플 견적의뢰 PDF를 올려 **품목 20건**이 판독되는지 확인합니다.
이 숫자가 바뀌면 파서를 건드린 것입니다. 의도한 변경이면 테스트 기대값도 함께 고치십시오.

설치된 Chromium이 Playwright가 기대하는 빌드와 다른 환경에서는 경로를 넘기십시오.

```bash
PW_CHROMIUM_PATH=/path/to/chrome npm test
```

## 디자인 시스템

`src/styles/tokens.css` 가 단일 출처입니다. 색·간격을 하드코딩하지 마십시오.

```
--ink #0e0e10   --canvas #ffffff   --cloud #f5f5f5   --hairline #cacacb
--mute #707072  --molten #0f62fe (IBM Blue 60 · 강조 전용)
--pill 30px
```

규칙
- 형태 어휘는 **각진 카드 + 알약형 버튼** 두 가지만
- 그림자 금지. 구분은 1px 헤어라인
- 파란색은 전체 면적의 5% 이내
- 서체: Pretendard(국문) · Anton(영문 헤드라인) · JetBrains Mono(치수·번호)
- 이모지 금지

## 문구 규칙

- 검증되지 않은 수치를 쓰지 마십시오 (예: "48시간 회신", "98% 만족")
- "최고", "혁신" 같은 표현 금지
- 단가·시세를 사이트가 제시하지 않습니다. 견적은 공급처가 냅니다
- 공급처 62곳은 **실존하지만 거래 이력이 없는 후보**입니다. 거래처로 표기하지 마십시오

## Design → Code 인수 절차

1. Design 산출물을 `design/` 에 넣습니다 (스펙 md + 토큰 값)
2. `design/CHANGELOG.md` 에 무엇이 바뀌었는지 한 줄 기록
3. Code는 `design/BRIEF.md` + `design/CONTRACT.md` 를 읽고 구현
4. 마크업을 그대로 복사하지 말고 토큰과 구조만 반영
5. 구현 후 `npm test` 통과 확인 → 커밋

## 데이터 · 배포

- **저장소** GitHub · **호스팅** Vercel · **데이터** Supabase (Netlify 미사용)
- `main` 에 push하면 Vercel이 자동 빌드합니다. PR을 올리면 미리보기 URL이 생성됩니다
- 문의 접수는 `src/engine/submit.js` → Supabase `rfq` 외 5개 테이블 + Storage `rfq-files`
- 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)가 없으면 메일 앱으로 폴백합니다
- 스키마는 `supabase/schema.sql` 이 단일 출처입니다. 테이블을 바꾸면 이 파일도 함께 고치십시오

### DB 작업 규칙

- 익명(anon)에게는 **insert만** 허용합니다. select 정책을 열지 마십시오
- `suppliers` 테이블은 담당자 전용입니다. 공급처 목록이 공개되면 안 됩니다
- **익명 키는 브라우저 번들에 그대로 들어갑니다.** RLS 와 테이블 제약이 유일한
  방어선이므로 `with check (true)` 를 쓰지 마십시오. 길이·개수 상한, 상태 고정,
  실존 `rfq_id` 검사를 겁니다 (`supabase/2026-08-22_harden_anon_insert.sql`)
- 진행 상태(`rfq.status`)는 담당자만 바꿉니다. 접수 시점은 항상 `접수`
- **`INSERT ... RETURNING` 을 쓰지 마십시오.** SELECT 권한과 SELECT 정책을 둘 다 요구해
  익명 경로에서 실패합니다. id 는 클라이언트에서 만들어 넣습니다 (`submit.js` 의 `newId()`)
- **필수 동의 없이는 접수되지 않습니다.** `rfq.agreed_at` 이 null 이면 RLS 가 막습니다
  (`supabase/2026-08-22_consent.sql`). 화면 체크박스는 보조 수단입니다
- 마이그레이션은 `supabase/` 아래에 날짜 파일로 남기십시오

### 엑셀 내려받기 — 받는 사람을 확인하십시오

`engine/export-rfq.js` 는 수신자별로 셋입니다. **고객 파일에 공급처 목록을 넣지 마십시오.**

| 함수 | 받는 사람 | 시트 |
|---|---|---|
| `exportRfq()` | 고객 (웹 버튼) | ① 요청서 · ③ 판독명세 · ④ 접수내역 |
| `exportRfqSupplier()` | 공급처 | ① 요청서 한 장 |
| `exportRfqInternal()` | 담당자 (백오피스) | 전부 — ② 발송처목록 포함 |


## 문서 위치

| 파일 | 내용 |
|---|---|
| `design/TASKS.md` | 작업 백로그 (우선순위·완료 조건) |
| `design/HANDOFF_DESIGN.md` | 메인 페이지 디자인 요구사항 |
| `design/CONTRACT.md` | 지켜야 할 DOM 훅·클래스 |
| `docs/CLAUDE_CODE_시작하기.md` | 붙여넣기용 지시문 모음 |
| `docs/세팅가이드.md` | 환경 구축 절차 |
| `docs/운영매뉴얼.md` | 서비스 운영 규칙·지표·판단 기준 |
| `supabase/schema.sql` | DB 스키마 (단일 출처) |

슬래시 명령: `/review` `/ship` `/design-sync` (`.claude/commands/`)

## 화면 두 벌

| 진입점 | 파일 | 대상 |
|---|---|---|
| `/` | `index.html` → `src/main.js` | 방문자 |
| `/admin` | `admin.html` → `src/admin/main.js` | 담당자 (Supabase Auth) |
| `/privacy` `/terms` | `privacy.html` `terms.html` → `src/legal/main.js` | 법정 고지 (정적) |

Vite 다중 진입점입니다 (`vite.config.js` 의 `rollupOptions.input`).
**백오피스는 xlsx·pdf 청크를 받지 않습니다** — 무거운 파서를 담당자 화면에 끌어오지 마십시오.
`/admin` 은 로그인 전에는 아무것도 렌더하지 않고, 데이터 차단은 전적으로 RLS 가 합니다.

## 화면 구성 (v4)

메인은 화면 3개입니다. 설명형 섹션은 없습니다.

1. **전체화면 문의창** `#desk` — 상단 바 + `1fr 560px`. 좌: 드롭·대화·완료 블록·입력 / 우: 판독 결과 레일
2. **거래 흐름** `#flow` — 지구본(Canvas 2D 정사영 + topojson) + 권역 4행
3. **회사 소개** `#about` — 정의문 · 원칙 3개 · CTA

- 3D 라이브러리를 쓰지 않습니다. three.js는 제거했습니다
- 지구본 지리 데이터는 `public/geo/countries-110m.json` (Natural Earth · world-atlas ISC).
  같은 출처에서 지연 로드합니다 — 외부 네트워크에 의존하지 마십시오
- 판독 결과는 표가 아니라 **품목 카드**입니다. 결손 사유 문구는 `engine/parse.js`의
  `diagnose()` 출력을 그대로 쓰고 새 문구를 만들지 마십시오
- 엔진의 상태값 `불가`는 화면에서 `확인 필요`로 표시합니다 (`ui/spec-table.js`의 `badge()`)

## 지금 남은 일

- [x] 백오피스 화면 `/admin` — 매직링크 로그인 · 요청 목록 · 상태 변경 · 첨부 · 공급처 회신 입력
- [ ] 공급처 마스터를 `suppliers` 테이블로 이관 후 백오피스에서 관리
- [ ] 공급처 마스터를 `suppliers` 테이블로 이관 후 실제 거래처 입력
- [ ] 공급처 회신 입력 화면 (지금은 엑셀 수신)
- [ ] 접수 알림 (Edge Function → 메일 또는 슬랙)
- [ ] 로고 선정 (`design_handoff_v4/METAL BRIDGE 로고 시안.dc.html` 10안) → 파비콘·앱 아이콘 교체
- [ ] 회사 정보 확정 → `privacy.html` · `terms.html` 의 `.todo` 표시 5곳 채우기
      (통신판매업 신고번호 · 대표 전화번호 2곳 · 시행일 2곳)
      확정분: 상호 (주) 그릿코퍼레이션 · 대표자 송시형 · 사업자등록번호 130-88-01458 ·
      소재지 부산광역시 금정구 조리2길 28 · 개인정보보호책임자 송시형(대표)
- [ ] 법정 고지 문안 법무 검토
