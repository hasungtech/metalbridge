/**
 * 공유 상태 — 엔진과 UI가 함께 참조합니다.
 * 새 필드를 추가할 때는 반드시 여기에만 추가하십시오.
 */
export const S = {
  ITEMS: [],      // 판독된 품목
  GAPS: null,     // 결손 진단 결과
  ANS: {},        // 고객 답변 (contact, due, place, mtc, extra, __no)
  QLOG: [],       // 확인 문답 기록
  picked: [],     // 첨부 파일 메타 {name,size}
  RAWFILES: [],   // 실제 File 객체
  SENT: false,
  MODE: 'free',   // free | qa | extra | done
  qQueue: [], qPos: 0, finished: false,
  filter: 'all',  // 판독 레일 상태 필터 (all | 확정 | 조건부 | 불가)
  lang: 'ko',     // 화면 언어 (ko | en | ja | zh) — i18n/index.js 가 정합니다
};
export const MB_MAIL = 'info@metalbridge.ai';
export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
