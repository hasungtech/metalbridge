# 디자인 변경 기록

형식: `날짜 · 무엇을 · 왜 · 영향 범위`

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
