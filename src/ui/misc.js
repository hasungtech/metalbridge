/** 떠 있는 소재 상담창 · 내부 링크 스크롤 · 히어로 상태 파생 */
import { S, reduce } from '../state.js';
import { t, lang, onLangChange } from '../i18n/index.js';

/**
 * 히어로 업로드 영역의 5개 상태를 S 에서 파생합니다.
 * S 에 화면 전용 필드를 추가하지 않고 기존 값만 읽습니다.
 *   force: 'drag' | 'reading' — 순간 상태는 호출부가 알려줍니다.
 */
export function syncHero(force){
  var drop=document.getElementById('drop');
  if(!drop) return;
  var glyph=drop.querySelector('.up-glyph');
  var title=document.getElementById('upTitle');
  var sub=document.getElementById('upSub');
  var bar=document.getElementById('upState');
  var deskNo=document.getElementById('deskNo');
  var deskSend=document.getElementById('deskSend');
  var deskState=document.getElementById('deskState');
  var files=S.picked.length, items=S.ITEMS.length, no=S.ANS.__no||'';
  var miss=S.ITEMS.filter(function(i){return i.state==='불가';}).length;
  var st;
  if(force==='drag'){
    st={c:'hot',g:'\u2193',t:t('hero.dropT'),s:t('hero.dropS'),bar:t('hero.dropBar'),dot:'busy'};
  } else if(force==='reading'){
    st={c:'reading',g:'\u25D0',t:t('hero.readT'),s:t('hero.readS',{n:files}),bar:t('hero.readBar'),dot:'busy'};
  } else if(S.SENT||S.MODE==='done'){
    st={c:'done',g:'\u2713',t:t('hero.doneT'),s:t('hero.doneS',{n:items}),bar:t('hero.doneBar'),dot:'live'};
  } else if((S.MODE==='qa'||S.MODE==='extra')&&S.qQueue&&S.qQueue.length){
    var n=Math.min(S.qPos+1,S.qQueue.length);
    st={c:'done',g:'\u2713',t:t('hero.qaT',{i:n,n:S.qQueue.length}),s:t('hero.qaS'),
        bar:t('hero.qaBar'),dot:'busy'};
  } else if(items){
    st={c:'done',g:'\u2713',t:t('hero.readyT'),s:t('hero.readyS',{n:files}),
        bar:miss?t('hero.missBar',{n:miss}):t('hero.readyBar'),dot:miss?'busy':'live'};
  } else {
    st={c:'',g:'+',t:t('hero.idleT'),s:t('hero.idleS'),bar:t('hero.idleBar'),dot:''};
  }
  drop.classList.remove('hot','reading','done');
  if(st.c) drop.classList.add(st.c);
  if(glyph) glyph.textContent=st.g;
  if(title) title.textContent=st.t;
  if(sub) sub.textContent=st.s;
  if(bar) bar.textContent=st.bar;
  if(deskNo) deskNo.textContent = no ? t('bar.no',{no:no}) : '';
  if(deskState){ deskState.classList.remove('live','busy'); if(st.dot) deskState.classList.add(st.dot); }
  if(deskSend){
    var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
    deskSend.textContent = items ? t('hero.sendable',{n:ok}) : '';
  }
}

export function initMisc(){
/* ══════════ 소재 상담 ══════════
   답변 본문은 i18n 사전(ai.a.*)에 있습니다. 여기에는 검색어만 둡니다 —
   어느 언어로 물어도 같은 항목이 걸리도록 4개 언어를 한 배열에 담았습니다. */
var KB=[
 {id:'ss',      k:['316','316l','304','스테인','stainless','ステンレス','不锈钢']},
 {id:'skd',     k:['skd11','금형','공구강','tool steel','die','金型','工具鋼','模具','工具钢']},
 {id:'inconel', k:['인코넬','inconel','625','600','718','니켈','nickel','ニッケル','因科镍','镍']},
 {id:'ti',      k:['티타늄','titanium','ti','gr.2','gr5','grade','チタン','钛']},
 {id:'mtc',     k:['밀시트','성적서','mtc','증명서','mill','certificate','ミルシート','証明','质保','材质证明']},
 {id:'al',      k:['a6061','알루미늄','6061','t6','7075','aluminium','aluminum','アルミ','铝']},
 {id:'scm',     k:['scm440','환봉','조질','기계구조','shaft','quench','temper','調質','丸棒','调质','轴']},
 {id:'sub',     k:['대체','대신','바꿔','substitute','alternative','instead','代替','替代']}
];
function answer(q){
  var s=(q||'').toLowerCase();
  for(var i=0;i<KB.length;i++){
    for(var j=0;j<KB[i].k.length;j++){
      if(s.indexOf(KB[i].k[j])>=0) return t('ai.a.'+KB[i].id);
    }
  }
  return t('ai.fallback');
}

/* ══════════ 떠 있는 소재 AI 창 ══════════ */
var aiwin=document.getElementById('aiwin'), fab=document.getElementById('fab'),
    fabLog=document.getElementById('fabLog'), opened=false;
function fabPush(cls,who,html){
  var d=document.createElement('div');
  d.className='msg '+cls;
  d.innerHTML='<div class="who">'+who+'</div>'+html;
  fabLog.appendChild(d); fabLog.scrollTop=fabLog.scrollHeight;
}
function fabAsk(q){
  if(!q.trim()) return;
  fabPush('me',t('desk.whoYou'),q);
  setTimeout(function(){ fabPush('sys',t('ai.who'),answer(q)); },360);
}
function openWin(){
  aiwin.classList.add('open'); fab.classList.add('hide');
  if(!opened){
    opened=true;
    fabPush('sys',t('ai.who'),t('ai.hello'));
  }
  setTimeout(function(){ document.getElementById('fabInput').focus(); },80);
}
function closeWin(){ aiwin.classList.remove('open'); fab.classList.remove('hide'); }
fab.addEventListener('click',openWin);
document.getElementById('aiClose').addEventListener('click',closeWin);
document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeWin(); });
document.getElementById('fabSend').addEventListener('click',function(){
  var el=document.getElementById('fabInput'); fabAsk(el.value); el.value='';
});
document.getElementById('fabInput').addEventListener('keydown',function(e){
  if(e.key==='Enter'){ fabAsk(this.value); this.value=''; }
});
document.getElementById('fabCta').addEventListener('click',closeWin);
var fabChips=document.getElementById('fabChips');
function paintChips(){
  fabChips.innerHTML='';
  t('ai.suggest').forEach(function(q){
    var b=document.createElement('button');
    b.type='button'; b.textContent=q;
    b.addEventListener('click',function(){ fabAsk(q); });
    fabChips.appendChild(b);
  });
}
paintChips();
onLangChange(function(){
  paintChips();
  var fl=document.getElementById('footLang');
  if(fl) fl.textContent=({ko:'한국어',en:'English',ja:'日本語',zh:'中文'})[lang()];
});
var footLang=document.getElementById('footLang');
if(footLang) footLang.textContent=({ko:'한국어',en:'English',ja:'日本語',zh:'中文'})[lang()];
/* ══════════ 히어로 업로드 영역으로 보내기 ══════════ */
function toDesk(){
  var d=document.getElementById('desk');
  if(d) d.scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'});
  var inp=document.getElementById('askIn');
  // preventScroll 없이 포커스하면 브라우저가 입력줄을 보이게 하려고 스크롤을 다시 잡습니다
  if(inp) setTimeout(function(){ inp.focus({preventScroll:true}); }, reduce?0:420);
}
['ctaUpload','fabCta','introAsk','barAsk'].forEach(function(id){
  var el=document.getElementById(id);
  if(el) el.addEventListener('click',toDesk);
});

/* ══════════ 내부 링크는 페이지 이동 없이 스크롤 ══════════ */
document.addEventListener('click',function(e){
  var a=e.target.closest ? e.target.closest('a[href^="#"]') : null;
  if(!a) return;
  var id=a.getAttribute('href');
  if(!id || id==='#') { e.preventDefault(); return; }
  var el=document.querySelector(id);
  if(!el) { e.preventDefault(); return; }
  e.preventDefault();
  el.scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'});
});

/* ── FAQ 하나만 열기 ── */
var dets=document.querySelectorAll('.faq details');
dets.forEach(function(d){
  d.addEventListener('toggle',function(){
    if(d.open) dets.forEach(function(o){ if(o!==d) o.open=false; });
  });
});

}
