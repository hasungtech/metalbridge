# METAL BRIDGE

특수 소재 견적 중개 플랫폼 — metalbridge.ai
운영: Grit Corporation

---

## 구성

| 역할 | 서비스 |
|---|---|
| 코드 | **GitHub** |
| 데이터 · 파일 · 인증 | **Supabase** |
| 호스팅 · 자동 배포 | **Vercel** |
| 작업 | **Claude Code 데스크톱 앱** |

Netlify는 사용하지 않습니다. Netlify Forms로 받던 문의는 Supabase 테이블로 옮겼습니다.

## 자동으로 도는 흐름

```
Claude Code 데스크톱 (로컬 저장소)
        │  코드 수정 → git push
        ▼
     GitHub  main
        │  (한 번 연결해두면 이후 자동)
        ▼
     Vercel 빌드 → metalbridge.ai 반영
        │  PR을 올리면 미리보기 URL 생성
        ▼
   고객 문의 → Supabase (rfq · rfq_items · rfq_files …)
        ▼
   담당자 백오피스에서 조회 · 상태 관리
```

사람이 하는 일은 **Claude Code에 지시하는 것**뿐입니다. push 이후는 전부 자동입니다.

---

## 최초 설정 (한 번만)

### 1. Supabase

1. SQL Editor에 `supabase/schema.sql` 을 그대로 붙여 실행
   → 테이블 6개 · RLS 정책 · Storage 버킷 `rfq-files` · 백오피스용 뷰가 생성됩니다
2. Project Settings → API 에서 **Project URL** 과 **anon public key** 복사
3. Authentication → Users 에서 담당자 계정 생성 (백오피스 로그인용)

### 2. 로컬

```bash
cp .env.example .env
# .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 입력
npm install
npm run dev      # http://localhost:5173
npm test         # 샘플 PDF 회귀 테스트
```

`.env` 가 비어 있으면 문의는 메일 앱으로 전송됩니다. 기능이 죽지는 않습니다.

### 3. Vercel

1. Add New → Project → GitHub 저장소 선택
2. Framework는 자동으로 **Vite** 로 잡힙니다 (`vercel.json` 에 명시)
3. Settings → Environment Variables 에 두 개 등록
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Settings → Domains 에 `metalbridge.ai` 추가
   → 등록처 DNS에서 A 레코드를 `76.76.21.21` 로, 또는 안내되는 네임서버로 변경

이후 `main` 에 push할 때마다 자동 배포됩니다.

### 4. Claude Code 데스크톱

저장소를 열면 `CLAUDE.md` 를 자동으로 읽습니다.
커넥터를 붙이면 지시 한 줄로 코드·DB·배포가 함께 움직입니다.

- **GitHub** — 커밋 · PR 생성
- **Supabase** — 테이블 조회 · 마이그레이션 실행

---

## 구조

```
index.html            화면 골격 (DOM 훅 7개)
src/
  state.js            공유 상태 S · 담당자 메일
  lib/supabase.js     Supabase 클라이언트 (env 없으면 null)
  engine/             DOM을 모르는 순수 로직
    parse.js          텍스트 → 품목 판독 · 결손 진단
    read-file.js      xlsx · pdf · csv → 텍스트 라인
    suppliers.js      공급처 74곳 · 소재 분류 · 매칭
    export-rfq.js     요청서 엑셀 4시트 생성
    submit.js         Supabase 접수 (실패 시 메일 폴백)
  ui/                 화면 조작
    chat.js  questions.js  spec-table.js  scene3d.js  misc.js  reveal.js
  styles/
    tokens.css        디자인 토큰 (단일 출처)
    base.css          레이아웃 · 컴포넌트
design/               Design 산출물 · 개발 계약
supabase/schema.sql   DB 스키마
tests/                Playwright 회귀 테스트
```

## Design → Code 인수

| 파일 | 누가 고치나 | 역할 |
|---|---|---|
| `design/BRIEF.md` | Design | 무엇을 왜 만드는가 |
| `design/CONTRACT.md` | 고정 | 깨뜨리면 안 되는 DOM 훅 · 클래스 |
| `src/styles/tokens.css` | Design → Code | 색 · 간격 단일 출처 |

Claude Code 지시 예시

> design/BRIEF.md 와 CONTRACT.md 를 읽고 메인 페이지를 재구성해줘.
> DOM 훅 7개와 npm test 는 반드시 통과해야 해.

## 남은 일

- [x] 메인 페이지 v4 재설계 (화면 3개 · three.js 제거 · 지구본 topojson)
- [ ] 백오피스 화면 `/admin` — 요청 목록 · 상태 변경 · 공급처 회신 입력
- [ ] `suppliers` 테이블에 실제 거래처 입력 후 코드 상수를 DB 조회로 전환
- [ ] 접수 알림 (Supabase Edge Function → 메일 또는 슬랙)
