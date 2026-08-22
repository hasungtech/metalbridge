/** 백오피스 — 담당자 전용.
 *  로그인하지 않으면 아무것도 보이지 않습니다. 데이터 접근은 전적으로 RLS 가 막습니다
 *  (익명에게는 select 권한이 없습니다 — supabase/schema.sql 참조).
 */
import '../styles/tokens.css';
import '../styles/base.css';
import './admin.css';
import { supabase, hasSupabase } from '../lib/supabase.js';
import { renderDetail } from './detail.js';

const $ = (id) => document.getElementById(id);
const gate = $('admGate'), main = $('admMain');

const STATUSES = ['접수', '확인중', '발송준비', '발송', '회신취합', '고객회신', '종료'];
let rows = [], filter = '전체', query = '', selected = null;

/* ══════════ 로그인 ══════════ */

function showGate(msg) {
  gate.hidden = false; main.hidden = true;
  $('admOut').hidden = true; $('admWho').textContent = '';
  if (msg) $('admMsg').textContent = msg;
}

async function boot() {
  if (!hasSupabase) {
    showGate('환경변수(VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY)가 없습니다. Vercel 설정을 확인하십시오.');
    $('admForm').hidden = true;
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) enter(data.session);
  else showGate('');
}

function enter(session) {
  gate.hidden = true; main.hidden = false;
  $('admOut').hidden = false;
  $('admWho').textContent = session.user.email || '';
  load();
}

$('admForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('admMail').value.trim();
  if (!email) return;
  const btn = $('admSend');
  btn.disabled = true; btn.textContent = '보내는 중…';
  // shouldCreateUser:false — 미리 초대된 담당자만 링크를 받습니다.
  // 켜두면 아무나 자기 주소로 계정을 만들어 authenticated 가 되고,
  // RLS 의 staff 정책이 using(true) 라 문의·공급처 명단을 전부 봅니다.
  // 익명 키는 번들에 노출되므로 이 플래그는 화면 보호일 뿐입니다 —
  // 실제 차단은 Supabase 대시보드의 회원가입 비활성화가 합니다.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/admin',
      shouldCreateUser: false,
    },
  });
  btn.disabled = false; btn.textContent = '로그인 링크 받기';
  $('admMsg').textContent = error
    ? '보내지 못했습니다 — ' + error.message
    : '메일함을 확인하십시오. 링크를 누르면 이 화면으로 돌아옵니다. 등록된 담당자만 받습니다.';
});

$('admOut').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showGate('로그아웃했습니다.');
});

if (hasSupabase) {
  supabase.auth.onAuthStateChange((_e, session) => {
    if (session) enter(session); else showGate('');
  });
}

/* ══════════ 목록 ══════════ */

async function load() {
  const list = $('admList');
  list.innerHTML = '<div class="empty"><p>불러오는 중…</p></div>';
  const { data, error } = await supabase
    .from('rfq_board').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) {
    list.innerHTML = '<div class="empty"><p>불러오지 못했습니다.<br><span class="mono">'
      + esc(error.message) + '</span></p></div>';
    return;
  }
  rows = data || [];
  paint();
}

function counts() {
  const c = { 전체: rows.length };
  STATUSES.forEach((s) => { c[s] = 0; });
  rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
  return c;
}

function visible() {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter !== '전체' && r.status !== filter) return false;
    if (!q) return true;
    return [r.rfq_no, r.contact, r.company].some((v) => (v || '').toLowerCase().includes(q));
  });
}

function paint() {
  const c = counts();
  $('admFilters').innerHTML = ['전체', ...STATUSES]
    .map((s) => `<button type="button" class="fchip mono${filter === s ? ' on' : ''}" data-s="${s}">${s} ${c[s] || 0}</button>`)
    .join('');
  Array.from($('admFilters').children).forEach((b) => {
    b.addEventListener('click', () => { filter = b.dataset.s; paint(); });
  });

  const v = visible();
  $('admList').innerHTML = v.length
    ? v.map(card).join('')
    : '<div class="empty"><p>해당하는 요청이 없습니다.</p></div>';
  Array.from($('admList').querySelectorAll('.arow')).forEach((el) => {
    el.addEventListener('click', () => select(el.dataset.id));
  });
  if (selected && !v.some((r) => r.id === selected)) selected = null;
}

function card(r) {
  const when = new Date(r.created_at).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const reply = r.supplier_count
    ? `회신 ${r.replied_count}/${r.supplier_count}` : '발송 전';
  return `<article class="arow${selected === r.id ? ' on' : ''}" data-id="${r.id}">
    <div class="arow-top">
      <span class="mono arow-no">${esc(r.rfq_no)}</span>
      <span class="astat s-${STATUSES.indexOf(r.status)}">${esc(r.status)}</span>
      <span class="mono arow-when">${when}</span>
    </div>
    <div class="arow-mid">${esc(r.company || r.contact || '(연락처 미기재)')}</div>
    <div class="mono arow-sub">품목 ${r.item_count}건 · 발송 가능 ${r.sendable}건 · ${reply}</div>
  </article>`;
}

async function select(id) {
  selected = id;
  paint();
  await renderDetail($('admDetail'), rows.find((r) => r.id === id), {
    statuses: STATUSES,
    onStatus: async (next) => {
      const { error } = await supabase.from('rfq').update({ status: next }).eq('id', id);
      if (error) return alert('상태를 바꾸지 못했습니다 — ' + error.message);
      const row = rows.find((r) => r.id === id);
      if (row) row.status = next;
      paint();
    },
  });
}

export function esc(t) {
  return String(t == null ? '' : t).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

$('admQ').addEventListener('input', (e) => { query = e.target.value; paint(); });
$('admReload').addEventListener('click', load);

boot();
