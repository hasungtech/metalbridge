# 디자인 변경 기록

형식: `날짜 · 무엇을 · 왜 · 영향 범위`

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
