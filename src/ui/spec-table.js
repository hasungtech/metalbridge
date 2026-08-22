/** 판독 결과 레일 — DOM 훅: #specBody, #specMeta
 *  v4: 품목 카드 목록 + 상태 필터 칩. 결손 사유 문구는 engine/parse.js 의 diagnose() 출력을 그대로 씁니다. */
import { S } from '../state.js';
import { exportRfq } from '../engine/export-rfq.js';

const LABEL = { 확정:'확정', 조건부:'조건부', 불가:'확인 필요' };
const CLS   = { 확정:'ok', 조건부:'warn', 불가:'miss' };

/** 화면 표시용 상태 라벨 — 엔진의 '불가' 는 화면에서 '확인 필요' 입니다. */
export function badge(st){
  return '<span class="tag '+(CLS[st]||'miss')+'">'+(LABEL[st]||st)+'</span>';
}

/** 길이 답변이 구체적인 치수면 치수 칸에 합쳐 보여줍니다 (예: 정척 6m → × 6,000). */
function dimOf(it){
  var dim = it.dim || '—';
  var m = (it.lenNote||'').match(/(\d+(?:\.\d+)?)\s*(m|mm|미터)\b/i);
  if(m){
    var mm = /mm/i.test(m[2]) ? Number(m[1]) : Number(m[1]) * 1000;
    if(mm > 0 && dim.indexOf(mm.toLocaleString()) < 0) dim += ' × ' + mm.toLocaleString();
  }
  return dim;
}

function esc(t){ return String(t==null?'':t).replace(/[<>&]/g, function(c){
  return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;'; }); }

function counts(){
  var c = { all:S.ITEMS.length, 확정:0, 조건부:0, 불가:0 };
  S.ITEMS.forEach(function(i){ if(c[i.state]!==undefined) c[i.state]++; });
  return c;
}

function card(it){
  var confirmed = it.note ? '<span class="card-fix mono">문답으로 확정</span>' : '';
  var issues = (it.issues||[]).length
    ? '<div class="card-issues"><span class="l mono">확인 항목</span><span class="chips">'+
      it.issues.map(function(s){ return '<span class="ichip">'+esc(s)+'</span>'; }).join('')+
      '</span></div>' : '';
  return '<article class="card" data-state="'+esc(it.state)+'">'+
    '<div class="card-top">'+
      '<span class="card-no mono">'+esc(it.no)+'</span>'+
      '<span class="card-mat">'+esc((it.grades||[]).join(' / ')||'(미기재)')+'</span>'+
      confirmed+
      '<span class="card-tag">'+badge(it.state)+'</span>'+
    '</div>'+
    '<div class="card-grid">'+
      '<div class="cell"><span class="l mono">형상</span><span class="v">'+esc(it.shape||'—')+'</span></div>'+
      '<div class="cell"><span class="l mono">치수 (mm)</span><span class="v mono">'+esc(dimOf(it))+'</span></div>'+
      '<div class="cell"><span class="l mono">수량</span><span class="v mono">'+esc(it.qty||'—')+'</span></div>'+
    '</div>'+
    issues+
    '<div class="card-raw"><span class="l mono">원문</span><span class="v mono">'+esc(it.raw||'')+'</span></div>'+
  '</article>';
}

function paintFilter(c){
  var wrap = document.getElementById('specFilter');
  if(!wrap) return;
  if(!S.ITEMS.length){ wrap.innerHTML=''; return; }
  var defs = [['all','전체',c.all],['확정','확정',c.확정],['조건부','조건부',c.조건부],['불가','확인 필요',c.불가]];
  wrap.innerHTML = defs.map(function(d){
    return '<button type="button" class="fchip mono'+(S.filter===d[0]?' on':'')+'" data-f="'+d[0]+'">'+
           d[1]+' '+d[2]+'</button>';
  }).join('');
  Array.prototype.forEach.call(wrap.children, function(b){
    b.addEventListener('click', function(){ S.filter = b.dataset.f; renderSpec(); });
  });
}

export function renderSpec(){
  var body = document.getElementById('specBody');
  var meta = document.getElementById('specMeta');
  var foot = document.getElementById('railFoot');
  if(!body) return;
  var c = counts();
  if(!S.filter) S.filter = 'all';

  if(!S.ITEMS.length){
    body.innerHTML = '<div class="empty"><p>아직 올린 자료가 없습니다.<br>왼쪽에 파일을 놓으면 여기에 정리됩니다.</p></div>';
    if(meta) meta.textContent = '자료를 올리면 정리됩니다.';
    paintFilter(c);
    if(foot) foot.hidden = true;
    return;
  }

  if(meta) meta.textContent = c.all+'건 중 확정 '+c.확정+' · 조건부 '+c.조건부+' · 확인 필요 '+c.불가;
  paintFilter(c);

  var rows = S.ITEMS.filter(function(i){ return S.filter==='all' || i.state===S.filter; });
  body.innerHTML = rows.length
    ? rows.map(card).join('')
    : '<div class="empty"><p>이 상태에 해당하는 품목이 없습니다.</p></div>';

  if(foot){
    foot.hidden = false;
    var ready = document.getElementById('railReady');
    if(ready) ready.textContent = '확정 '+c.확정+'건은 지금 상태로 공급망에 보낼 수 있습니다.';
    var dl = document.getElementById('dlRfqRail');
    if(dl && !dl.dataset.on){ dl.dataset.on='1'; dl.addEventListener('click', exportRfq); }
  }
}
