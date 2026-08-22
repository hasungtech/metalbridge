/** 판독 결과 레일 — DOM 훅: #specBody, #specMeta
 *  v4: 품목 카드 목록 + 상태 필터 칩. 결손 사유 문구는 engine/parse.js 의 diagnose() 출력을 그대로 씁니다. */
import { S } from '../state.js';
import { exportRfq } from '../engine/export-rfq.js';
import { t } from '../i18n/index.js';

const CLS = { 확정:'ok', 조건부:'warn', 불가:'miss' };

/** 화면 표시용 상태 라벨 — 엔진의 '불가' 는 화면에서 '확인 필요' 입니다.
 *  엔진 값은 한국어 그대로 두고 여기서만 번역합니다 (비교에 쓰이는 식별자입니다). */
export function stateLabel(st){ return t('state.'+st); }
export function badge(st){
  return '<span class="tag '+(CLS[st]||'miss')+'">'+stateLabel(st)+'</span>';
}

/** 형상 — parse.js 의 SHAPES 이름을 키로 씁니다. 모르는 값은 원문 그대로. */
export function shapeLabel(v){
  if(!v) return t('card.dash');
  var k = t('shape.'+v);
  return k === 'shape.'+v ? v : k;
}

/** 결손 사유 — diagnose() 가 낸 한국어 문자열을 키로 씁니다. */
function issueText(s){
  var m = /^중복 의심\((\d+)번\)$/.exec(s);
  if(m) return t('issue.dup', { no:m[1] });
  return t('issue.'+s);
}

/** 길이 답변이 구체적인 치수면 치수 칸에 합쳐 보여줍니다 (예: 정척 6m → × 6,000). */
function dimOf(it){
  var dim = it.dim === '(미기재)' ? t('card.none') : (it.dim || t('card.dash'));
  var m = (it.lenNote||'').match(/(\d+(?:\.\d+)?)\s*(m|mm|미터)\b/i);
  if(m){
    var mm = /mm/i.test(m[2]) ? Number(m[1]) : Number(m[1]) * 1000;
    if(mm > 0 && dim.indexOf(mm.toLocaleString()) < 0) dim += ' × ' + mm.toLocaleString();
  }
  return dim;
}

function esc(v){ return String(v==null?'':v).replace(/[<>&]/g, function(c){
  return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;'; }); }

function counts(){
  var c = { all:S.ITEMS.length, 확정:0, 조건부:0, 불가:0 };
  S.ITEMS.forEach(function(i){ if(c[i.state]!==undefined) c[i.state]++; });
  return c;
}

function card(it){
  var confirmed = it.note ? '<span class="card-fix mono">'+t('card.fixed')+'</span>' : '';
  var issues = (it.issues||[]).length
    ? '<div class="card-issues"><span class="l mono">'+t('card.issues')+'</span><span class="chips">'+
      it.issues.map(function(s){ return '<span class="ichip">'+esc(issueText(s))+'</span>'; }).join('')+
      '</span></div>' : '';
  return '<article class="card" data-state="'+esc(it.state)+'">'+
    '<div class="card-top">'+
      '<span class="card-no mono">'+esc(it.no)+'</span>'+
      '<span class="card-mat">'+esc((it.grades||[]).join(' / ')||t('card.none'))+'</span>'+
      confirmed+
      '<span class="card-tag">'+badge(it.state)+'</span>'+
    '</div>'+
    '<div class="card-grid">'+
      '<div class="cell"><span class="l mono">'+t('card.shape')+'</span><span class="v">'+esc(shapeLabel(it.shape))+'</span></div>'+
      '<div class="cell"><span class="l mono">'+t('card.dim')+'</span><span class="v mono">'+esc(dimOf(it))+'</span></div>'+
      '<div class="cell"><span class="l mono">'+t('card.qty')+'</span><span class="v mono">'+esc(it.qty||t('card.dash'))+'</span></div>'+
    '</div>'+
    issues+
    '<div class="card-raw"><span class="l mono">'+t('card.raw')+'</span><span class="v mono">'+esc(it.raw||'')+'</span></div>'+
  '</article>';
}

function paintFilter(c){
  var wrap = document.getElementById('specFilter');
  if(!wrap) return;
  if(!S.ITEMS.length){ wrap.innerHTML=''; return; }
  var defs = [['all',t('rail.all'),c.all],['확정',stateLabel('확정'),c.확정],
              ['조건부',stateLabel('조건부'),c.조건부],['불가',stateLabel('불가'),c.불가]];
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
    body.innerHTML = '<div class="empty"><p>'+t('rail.empty')+'</p></div>';
    if(meta) meta.textContent = t('rail.metaEmpty');
    paintFilter(c);
    if(foot) foot.hidden = true;
    return;
  }

  if(meta) meta.textContent = t('rail.meta', { all:c.all, ok:c.확정, cond:c.조건부, miss:c.불가 });
  paintFilter(c);

  var rows = S.ITEMS.filter(function(i){ return S.filter==='all' || i.state===S.filter; });
  body.innerHTML = rows.length
    ? rows.map(card).join('')
    : '<div class="empty"><p>'+t('rail.emptyFilter')+'</p></div>';

  if(foot){
    foot.hidden = false;
    var ready = document.getElementById('railReady');
    if(ready) ready.textContent = t('rail.ready', { n:c.확정 });
    ['dlRfqRail','dlRfqFlow'].forEach(function(id){
      var dl = document.getElementById(id);
      if(dl && !dl.dataset.on){ dl.dataset.on='1'; dl.addEventListener('click', exportRfq); }
    });
  }
}
