/** 떠 있는 소재 상담창 · 내부 링크 스크롤 · 히어로 이동 */
import { S, reduce } from '../state.js';
export function initMisc(){
/* ══════════ 소재 상담 ══════════ */
var KB=[
 {k:['316','316l','304'],a:'316L은 316의 탄소 함량을 0.03% 이하로 낮춘 강종입니다. 용접을 하면 탄소가 크롬과 결합해 결정 경계에서 내식성이 떨어지는데(입계부식), L 등급은 이를 막습니다.<br><br>용접 부위가 있고 부식 환경이면 316L, 용접이 없거나 상온 일반 환경이면 316으로 충분합니다. 304 대비 316은 몰리브덴이 들어가 염분·산성 환경에 강합니다.'},
 {k:['skd11','금형','공구강'],a:'SKD11은 냉간 금형용 합금공구강입니다. 크롬 12% 계열로 내마모성이 높아 프레스 금형 다이·펀치에 씁니다.<br><br>일반 요구 경도는 HRC58~62이며, 열처리 상태(생재/조질/담금질 완료)에 따라 단가와 가공 난이도가 달라집니다. 견적 요청 시 경도 요구치를 함께 주시면 회신 정확도가 올라갑니다.'},
 {k:['인코넬','625','600','718','니켈'],a:'인코넬 600은 고온 산화에 강한 니켈크롬 합금이고, 625는 여기에 니오븀·몰리브덴을 넣어 고온 강도와 내식성을 함께 확보한 강종입니다. 718은 석출경화형으로 고온 강도가 가장 높아 터빈 부품에 씁니다.<br><br>부식이 없는 단순 고온이면 600으로 단가를 크게 낮출 수 있습니다. 산성·염화물 환경이면 625가 맞습니다.'},
 {k:['티타늄','ti','gr.2','gr5','grade'],a:'Ti Gr.2는 합금 원소가 없는 순티타늄으로 내식성이 최고 수준이라 화학·해수 설비에 씁니다. Gr.5(Ti-6Al-4V)는 알루미늄·바나듐을 넣어 강도를 크게 올린 합금으로 항공·의료용입니다.<br><br>강도가 필요 없다면 Gr.2가 단가와 가공성 모두 유리합니다. 리드타임이 12~20주라 납기를 먼저 확인하시는 편이 좋습니다.'},
 {k:['밀시트','성적서','mtc','증명서'],a:'밀시트(Mill Test Certificate)는 제조사가 발행하는 재질 증명서입니다. 로트 번호, 화학 성분, 기계적 성질(항복강도·인장강도·연신율), 열처리 조건이 기재됩니다.<br><br>구조용·압력용기용 소재는 밀시트가 없으면 사용할 수 없습니다. 저희는 성적서 없는 소재를 별도 표기하고 구조용 매칭에서 제외합니다.'},
 {k:['a6061','알루미늄','6061','t6','7075'],a:'A6061-T6는 마그네슘·규소계 열처리 알루미늄으로 강도와 가공성이 균형 잡혀 기계 부품·치공구에 널리 씁니다. A7075는 아연계 초고강도 합금으로 6061보다 훨씬 단단하지만 내식성과 용접성이 떨어집니다.<br><br>T6는 용체화 처리 후 인공시효를 거친 상태를 뜻합니다. 열처리 표기가 없는 재료는 강도를 보증할 수 없습니다.'},
 {k:['scm440','환봉','조질','기계구조'],a:'SCM440은 크롬몰리브덴강으로 열처리로 강도를 올려 축·기어·볼트에 씁니다.<br><br>조질재(QT)는 담금질·뜨임까지 끝난 상태라 바로 가공하면 되고, 생재는 가공 후 열처리가 필요합니다. 단가와 납기가 다르니 견적 요청 시 어느 쪽인지 명시해 주십시오.'},
 {k:['대체','대신','바꿔'],a:'대체 가능 여부는 용도가 결정합니다. 구조용은 항복강도, 부식 환경은 성분, 금형은 경도가 기준입니다.<br><br>사양서에 용도와 사용 환경을 적어주시면 대체 가능한 강종을 함께 찾아 견적받겠습니다. 판단이 어려우면 원 강종과 대체안 두 가지를 동시에 요청해 비교해 드립니다.'}
];
var FALLBACK='그 부분은 사양과 용도를 조금 더 알아야 정확히 답할 수 있습니다. 강종·형상·사용 환경을 알려주시거나, 가지고 계신 자료를 위쪽에서 올려주시면 담당자가 확인해 회신하겠습니다.';
var SUGGEST=['316과 316L 차이가 뭡니까','SKD11 경도는 얼마로 잡습니까','인코넬 600 대신 625 써야 합니까',
             '밀시트가 뭡니까','티타늄 Gr.2와 Gr.5 차이','SCM440 조질재와 생재'];

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
  fabPush('me','고객사',q);
  setTimeout(function(){ fabPush('sys','METAL BRIDGE AI',answer(q)); },360);
}
function openWin(){
  aiwin.classList.add('open'); fab.classList.add('hide');
  if(!opened){
    opened=true;
    fabPush('sys','METAL BRIDGE AI','소재에 관해 궁금하신 점을 물어보십시오. 강종 차이, 대체 가능 여부, 규격·성적서 용어를 답해 드립니다.');
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
SUGGEST.forEach(function(q){
  var b=document.createElement('button');
  b.type='button'; b.textContent=q;
  b.addEventListener('click',function(){ fabAsk(q); });
  fabChips.appendChild(b);
});
/* ══════════ 히어로 업로드 영역으로 보내기 ══════════ */
function toHero(focusText){
  var top=document.getElementById('top');
  if(top) top.scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'});
  if(!focusText) return;
  var hi=document.getElementById('heroIn');
  if(hi) setTimeout(function(){ hi.focus(); }, reduce?0:420);
}
[['navAsk',false],['ctaUpload',false],['ctaText',true]].forEach(function(pair){
  var el=document.getElementById(pair[0]);
  if(el) el.addEventListener('click',function(){ toHero(pair[1]); });
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
