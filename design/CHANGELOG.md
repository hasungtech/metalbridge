# 디자인 변경 기록

형식: `날짜 · 무엇을 · 왜 · 영향 범위`

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
