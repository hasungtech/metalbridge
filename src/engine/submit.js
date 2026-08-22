/**
 * 견적 문의 접수 — Supabase 저장
 * 환경변수가 없으면 메일 앱으로 대체합니다.
 */
import { supabase, hasSupabase } from '../lib/supabase.js';
import { S, MB_MAIL } from '../state.js';
import { matchSuppliers, catOf } from './suppliers.js';
import { rfqNo, summaryCounts, buildMailBody } from './export-rfq.js';

export async function submitRfq() {
  const no = rfqNo();
  const c = summaryCounts();

  if (!hasSupabase) return { mode: 'mail', no, run: mailFallback };

  try {
    // 1. 헤더
    const { data: rfq, error: e1 } = await supabase
      .from('rfq')
      .insert({
        rfq_no: no,
        status: c.no > 0 ? '확인중' : '발송준비',
        contact: S.ANS.contact || null,
        due: S.ANS.due || null,
        place: S.ANS.place || null,
        mtc: S.ANS.mtc || null,
        extra: S.ANS.extra || S.ANS.memo || null,
        item_count: S.ITEMS.length,
        sendable: c.ok,
      })
      .select('id')
      .single();
    if (e1) throw e1;
    const rfqId = rfq.id;

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
      const path = `${no}/${Date.now()}_${f.name}`;
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
