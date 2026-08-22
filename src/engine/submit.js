/**
 * 견적 문의 접수 — Supabase 저장
 * 환경변수가 없으면 메일 앱으로 대체합니다.
 */
import { supabase, hasSupabase } from '../lib/supabase.js';
import { S, MB_MAIL } from '../state.js';
import { matchSuppliers, catOf } from './suppliers.js';
import { rfqNo, summaryCounts, buildMailBody } from './export-rfq.js';

/** 스토리지 경로에 쓸 수 있게 파일명을 정리합니다 (경로 이탈·특수문자 방지) */
function safeName(name) {
  return String(name)
    .replace(/[\\/]/g, '_')          // 경로 구분자 제거
    .replace(/[^\w.\-가-힣ㄱ-ㅎㅏ-ㅣ ]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120) || 'file';
}

/** 접수 id 를 클라이언트에서 만듭니다.
 *  INSERT ... RETURNING 은 SELECT 권한과 SELECT 정책을 둘 다 요구합니다.
 *  익명에게 조회를 열지 않으려면 id 를 미리 정해 되돌려받지 않는 편이 맞습니다. */
function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function submitRfq() {
  const no = rfqNo();
  const c = summaryCounts();

  if (!hasSupabase) return { mode: 'mail', no, run: mailFallback };

  try {
    // 1. 헤더 — id 를 직접 정해 되돌려받지 않습니다 (익명 조회 권한 불필요)
    const rfqId = newId();
    const { error: e1 } = await supabase
      .from('rfq')
      .insert({
        id: rfqId,
        rfq_no: no,
        // 진행 상태는 담당자가 정합니다. 접수 시점은 항상 '접수'
        status: '접수',
        contact: S.ANS.contact || null,
        due: S.ANS.due || null,
        place: S.ANS.place || null,
        mtc: S.ANS.mtc || null,
        extra: S.ANS.extra || S.ANS.memo || null,
        item_count: S.ITEMS.length,
        sendable: c.ok,
        agreed_at: new Date().toISOString(),
        marketing_opt_in: !!document.getElementById('agreeOpt')?.checked,
      });
    if (e1) throw e1;

    // 2. 품목
    if (S.ITEMS.length) {
      const rows = S.ITEMS.map((it) => ({
        rfq_id: rfqId,
        no: it.no,
        grade: (it.grades || []).join(' / ') || null,
        category: catOf((it.grades || []).join(' ')),
        shape: it.shape,
        dim: it.dim,
        qty: it.qty || null,
        state: it.state,
        issues: (it.issues || []).join(' · ') || null,
        raw: it.raw,
      }));
      const { error } = await supabase.from('rfq_items').insert(rows);
      if (error) throw error;
    }

    // 3. 확인 문답
    if (S.QLOG.length) {
      const rows = S.QLOG.map((q, i) => ({
        rfq_id: rfqId, seq: i + 1, label: q.label, question: q.q,
        answer: q.a, rows: (q.rows || []).join(', ') || null,
      }));
      const { error } = await supabase.from('rfq_answers').insert(rows);
      if (error) throw error;
    }

    // 4. 발송 후보 공급처
    const ms = matchSuppliers();
    if (ms.length) {
      const rows = ms.map((m, i) => ({
        rfq_id: rfqId,
        supplier_name: m.sp.n,
        score: m.score,
        items: m.items.join(', '),
        batch: i < 8 ? '1차' : '2차',
      }));
      const { error } = await supabase.from('rfq_suppliers').insert(rows);
      if (error) throw error;
    }

    // 5. 첨부 파일 업로드
    for (const f of S.RAWFILES) {
      const path = `${no}/${Date.now()}_${safeName(f.name)}`;
      const { error: eUp } = await supabase.storage.from('rfq-files').upload(path, f);
      if (eUp) continue;
      await supabase.from('rfq_files').insert({
        rfq_id: rfqId, path, file_name: f.name, size: f.size, kind: '고객자료',
      });
    }

    S.SENT = true;
    return { mode: 'db', no, id: rfqId };
  } catch (err) {
    console.warn('Supabase 저장 실패 — 메일로 대체합니다:', err.message);
    return { mode: 'mail', no, run: mailFallback, error: err.message };
  }
}

export function mailFallback() {
  const no = rfqNo();
  window.location.href =
    'mailto:' + MB_MAIL +
    '?subject=' + encodeURIComponent('[견적문의] ' + no + ' · 품목 ' + S.ITEMS.length + '건') +
    '&body=' + encodeURIComponent(buildMailBody());
  S.SENT = true;
}
