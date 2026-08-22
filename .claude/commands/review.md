현재 변경사항을 아래 기준으로 점검하고 문제를 목록으로 보고해줘.

1. DOM 훅 7개가 모두 존재하는가 — drop, fileInput, askLog, askChips, askIn, specBody, specMeta
2. 필수 클래스가 유지되는가 — .abub.sys, .abub.me, .tag.ok, .tag.warn, .tag.miss
3. src/engine/* 안에서 document 나 window 를 직접 만지고 있지 않은가
4. 색·간격을 하드코딩한 곳이 있는가 (tokens.css 변수를 써야 함)
5. 검증되지 않은 수치가 화면 문구에 들어갔는가 (예: 48시간, 98%)
6. npm test 가 통과하는가

문제가 없으면 "이상 없음" 한 줄만 답해줘.
