/** 요청 상세 — 품목 명세 · 확인 문답 · 첨부 다운로드 · 공급처 회신 입력 */
import { supabase } from '../lib/supabase.js';
import { esc } from './main.js';

const CLS = { 확정: 'ok', 조건부: 'warn', 불가: 'miss' };
const LABEL = { 확정: '확정', 조건부: '조건부', 불가: '확인 필요' };

export async function renderDetail(box, row, opt) {
  if (!row) { box.innerHTML = '<div class="empty"><p>왼쪽에서 요청을 선택하십시오.</p></div>'; return; }
  box.innerHTML = '<div class="empty"><p>불러오는 중…</p></div>';

  const [items, answers, sups, files] = await Promise.all([
    supabase.from('rfq_items').select('*').eq('rfq_id', row.id).order('no'),
    supabase.from('rfq_answers').select('*').eq('rfq_id', row.id).order('seq'),
    supabase.from('rfq_suppliers').select('*').eq('rfq_id', row.id).order('score', { ascending: false }),
    supabase.from('rfq_files').select('*').eq('rfq_id', row.id).order('id'),
  ]);

  const err = [items, answers, sups, files].find((r) => r.error);
  if (err) { box.innerHTML = `<div class="empty"><p>불러오지 못했습니다.<br><span class="mono">${esc(err.error.message)}</span></p></div>`; return; }

  box.innerHTML = `
    <div class="ad-head">
      <div>
        <span class="mono ad-no">${esc(row.rfq_no)}</span>
        <span class="mono ad-when">${new Date(row.created_at).toLocaleString('ko-KR')}</span>
      </div>
      <select class="ad-status" id="adStatus" aria-label="상태 변경">
        ${opt.statuses.map((s) => `<option${s === row.status ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>

    <dl class="ad-facts">
      ${fact('연락처', row.contact)}${fact('고객사', row.company)}
      ${fact('희망 납기', row.due)}${fact('인도 장소', row.place)}
    </dl>

    ${section('첨부 자료', files.data.length
      ? `<div class="ad-files">${files.data.map(fileRow).join('')}</div>`
      : '<p class="cap">첨부 없음</p>')}

    ${section(`품목 명세 (${items.data.length}건)`, items.data.length
      ? `<div class="ad-items">${items.data.map(itemRow).join('')}</div>`
      : '<p class="cap">판독된 품목 없음</p>')}

    ${section(`확인 문답 (${answers.data.length}건)`, answers.data.length
      ? `<div class="ad-qa">${answers.data.map(qaRow).join('')}</div>`
      : '<p class="cap">문답 없음</p>')}

    ${section(`발송 후보 공급처 (${sups.data.length}곳)`, sups.data.length
      ? `<table class="ad-sup"><thead><tr>
           <th>차수</th><th>공급처</th><th>적합도</th><th>단가</th><th>납기</th><th>회신</th><th></th>
         </tr></thead><tbody>${sups.data.map(supRow).join('')}</tbody></table>`
      : '<p class="cap">매칭된 공급처 없음</p>')}
  `;

  box.querySelector('#adStatus').addEventListener('change', (e) => opt.onStatus(e.target.value));

  /* 첨부 다운로드 — 버킷이 비공개라 서명 URL 을 그때그때 만듭니다 */
  box.querySelectorAll('[data-path]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      const { data, error } = await supabase.storage
        .from('rfq-files').createSignedUrl(b.dataset.path, 60);
      b.disabled = false;
      if (error) return alert('내려받지 못했습니다 — ' + error.message);
      window.open(data.signedUrl, '_blank', 'noopener');
    });
  });

  /* 공급처 회신 입력 */
  box.querySelectorAll('.ad-sup-save').forEach((b) => {
    b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const price = tr.querySelector('[data-f="unit_price"]').value.trim();
      const lead = tr.querySelector('[data-f="lead_time"]').value.trim();
      b.disabled = true; b.textContent = '저장 중';
      const { error } = await supabase.from('rfq_suppliers').update({
        unit_price: price || null,
        lead_time: lead || null,
        replied_at: (price || lead) ? new Date().toISOString() : null,
      }).eq('id', Number(b.dataset.sid));
      b.disabled = false; b.textContent = '저장';
      if (error) return alert('저장하지 못했습니다 — ' + error.message);
      tr.classList.toggle('replied', !!(price || lead));
    });
  });
}

const fact = (k, v) => `<div><dt class="mono">${k}</dt><dd>${esc(v) || '<span class="cap">—</span>'}</dd></div>`;
const section = (title, body) =>
  `<section class="ad-sec"><h3 class="mono ad-sec-h">${esc(title)}</h3>${body}</section>`;

function fileRow(f) {
  const kb = f.size ? Math.round(f.size / 1024).toLocaleString() + ' KB' : '';
  return `<div class="ad-file">
    <span class="ad-file-n">${esc(f.file_name || f.path)}</span>
    <span class="mono cap">${kb}</span>
    <button class="btn btn-outline btn-sm" type="button" data-path="${esc(f.path)}">내려받기</button>
  </div>`;
}

function itemRow(it) {
  return `<div class="ad-item">
    <span class="mono ad-item-no">${it.no}</span>
    <span class="ad-item-m">${esc(it.grade) || '(미기재)'}</span>
    <span class="mono ad-item-d">${esc(it.shape)} · ${esc(it.dim)}${it.qty ? ' · ' + esc(it.qty) : ''}</span>
    <span class="tag ${CLS[it.state] || 'miss'}">${LABEL[it.state] || esc(it.state)}</span>
    ${it.issues ? `<span class="mono ad-item-i">${esc(it.issues)}</span>` : ''}
  </div>`;
}

function qaRow(q) {
  return `<div class="ad-q">
    <span class="mono ad-q-n">${q.seq}</span>
    <div><b>${esc(q.label)}</b><p class="cap">${esc(q.question)}</p>
    <p class="ad-q-a">${esc(q.answer)}</p>
    ${q.rows ? `<p class="mono cap">적용 품목 ${esc(q.rows)}</p>` : ''}</div>
  </div>`;
}

function supRow(s) {
  return `<tr class="${s.replied_at ? 'replied' : ''}">
    <td class="mono">${esc(s.batch) || '-'}</td>
    <td>${esc(s.supplier_name)}</td>
    <td class="mono">${s.score != null ? s.score + '%' : '-'}</td>
    <td><input data-f="unit_price" value="${esc(s.unit_price)}" placeholder="예) 4,200원/kg" aria-label="단가"></td>
    <td><input data-f="lead_time"  value="${esc(s.lead_time)}"  placeholder="예) 3주" aria-label="납기"></td>
    <td class="mono">${s.replied_at ? new Date(s.replied_at).toLocaleDateString('ko-KR') : '-'}</td>
    <td><button class="btn btn-outline btn-sm ad-sup-save" type="button" data-sid="${s.id}">저장</button></td>
  </tr>`;
}
