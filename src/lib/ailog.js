/** AI 계측 로그 — 로드맵 0.5단계 (design/AI_ROADMAP.md)
 *
 *  이후 단계의 트리거가 전부 지표라, 지표의 근거를 여기서 만듭니다.
 *   ask        상담 질문 (hit = 매칭 카드 id, 폴백이면 null)
 *   parse_ok   텍스트 입력이 품목으로 잡힘 (hit = "확정n/총m")
 *   parse_fail 텍스트 입력이 품목으로 안 잡힘 (q = 원문)
 *   qa_drop    문답 중도 이탈 (q = 문항 키, hit = "위치/전체")
 *
 *  실패해도 화면에 아무 영향이 없어야 합니다 — 절대 던지지 않고,
 *  환경변수가 없으면 조용히 아무것도 하지 않습니다.
 */
import { supabase } from './supabase.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function row(kind, q, hit) {
  return {
    id: newId(),
    kind: kind,
    q: String(q == null ? '' : q).slice(0, 500) || null,
    hit: hit == null ? null : String(hit).slice(0, 80),
    lang: (document.documentElement.lang || 'ko').slice(0, 5),
  };
}

export function aiLog(kind, q, hit) {
  if (!supabase) return;
  try {
    supabase.from('ai_log').insert(row(kind, q, hit)).then(function () {}, function () {});
  } catch (e) { /* 계측은 본편을 깨지 않습니다 */ }
}

/** 페이지를 떠나는 순간의 기록 — supabase-js 는 unload 중 완료를 보장하지
 *  않으므로 keepalive fetch 로 직접 보냅니다. */
export function aiLogBeacon(kind, q, hit) {
  if (!url || !key) return;
  try {
    fetch(url + '/rest/v1/ai_log', {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row(kind, q, hit)),
    }).catch(function () {});
  } catch (e) { /* 위와 같음 */ }
}
