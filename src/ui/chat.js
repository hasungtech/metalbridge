/** 업로드 · 대화 흐름
 *  DOM 훅: #drop #fileInput #askLog #askChips #askIn #askSend #askAttach
 */
import { S, reduce } from '../state.js';
import { parseLine, diagnose } from '../engine/parse.js';
import { linesFromFile } from '../engine/read-file.js';
import { matchSuppliers } from '../engine/suppliers.js';
import { exportRfq, rfqNo } from '../engine/export-rfq.js';
import { submitRfq } from '../engine/submit.js';
import { renderSpec, shapeLabel } from './spec-table.js';
import { buildQuestions, applyAnswer } from './questions.js';
import { syncHero } from './misc.js';
import { t } from '../i18n/index.js';
/* 공급처 마스터의 국가명(한국어) → 권역 키. 사전에 없는 나라는 원문 그대로 둡니다. */
const CC = { '한국':'kr', '중국':'cn', '일본':'jp', '인도':'in' };

export function initChat(){
const dropEl   = document.getElementById('drop');
const fileInput= document.getElementById('fileInput');
const askLog   = document.getElementById('askLog');
const askChips = document.getElementById('askChips');
const askIn    = document.getElementById('askIn');

function bub(cls,who,html){
  var d=document.createElement('div');
  d.className='abub '+cls;
  d.innerHTML=(who?'<div class="who">'+who+'</div>':'')+html;
  askLog.appendChild(d);
  askLog.scrollTop=askLog.scrollHeight;
  return d;
}
function sys(html){ return bub('sys',t('desk.whoUs'),html); }
function me(html){ return bub('me',t('desk.whoYou'),html); }
/** list 는 문자열 또는 {v,t}. 화면에는 t 를, 콜백에는 v(한국어 식별자)를 넘깁니다. */
function chips(list,fn){
  askChips.innerHTML='';
  (list||[]).forEach(function(o){
    var v = (o && o.v !== undefined) ? o.v : o;
    var label = (o && o.t !== undefined) ? o.t : o;
    var b=document.createElement('button');
    b.type='button'; b.textContent=label;
    b.addEventListener('click',function(){ askChips.innerHTML=''; fn(v,label); });
    askChips.appendChild(b);
  });
}
['dragenter','dragover'].forEach(function(ev){
  dropEl.addEventListener(ev,function(e){ e.preventDefault(); e.stopPropagation(); syncHero('drag'); });
});
['dragleave','dragend'].forEach(function(ev){
  dropEl.addEventListener(ev,function(e){ e.preventDefault(); syncHero(); });
});
dropEl.addEventListener('drop',function(e){
  e.preventDefault(); e.stopPropagation(); syncHero();
  if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length) takeFiles(e.dataTransfer.files);
});
['dragover','drop'].forEach(function(ev){ window.addEventListener(ev,function(e){ e.preventDefault(); },false); });
dropEl.addEventListener('click',function(){ fileInput.click(); });
dropEl.addEventListener('keydown',function(e){
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileInput.click(); }
});
document.getElementById('askAttach').addEventListener('click',function(){ fileInput.click(); });
fileInput.addEventListener('change',function(){
  if(!this.files||!this.files.length) return;
  if(!consentOk()){ this.value=''; return; }
  takeFiles(this.files);
});

function fmtSize(b){
  if(b<1024) return b+' B';
  if(b<1048576) return (b/1024).toFixed(0)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}
function extOf(n){ var m=(n||'').split('.').pop().toLowerCase(); return m.length>5?'FILE':m.toUpperCase(); }


function takeFiles(list){
  var real=[];
  Array.prototype.forEach.call(list,function(f){
    if(S.picked.length<6){ S.picked.push({name:f.name,size:f.size}); real.push(f); S.RAWFILES.push(f); }
  });
  syncHero('reading');
  real.forEach(function(f){
    me('<b>'+extOf(f.name)+'</b> '+f.name.replace(/[<>]/g,'')+
       '<span class="mini">'+fmtSize(f.size)+'</span>');
  });
  var wait=sys(t('chat.reading'));
  startRead(real, wait);
}

function startRead(files, waitBub){
  var status=document.getElementById('upState');
  if(status) status.textContent=t('hero.parsing');
  var readErr=null;
  var jobs=Array.prototype.map.call(files,function(f){
    return linesFromFile(f).catch(function(e){ readErr=(f.name+' — '+(e&&e.message||t('chat.readFail'))); return []; });
  });
  Promise.all(jobs).then(function(all){
    var lines=[].concat.apply([],all);
    var add=[];
    lines.forEach(function(l){ var it=parseLine(l); if(it) add.push(it); });
    S.ITEMS=S.ITEMS.concat(add);
    S.GAPS=diagnose(S.ITEMS);
    renderSpec();
    syncHero();
    if(status) status.textContent = S.ITEMS.length? t('hero.parsed') : t('hero.needCheck');
    if(waitBub && waitBub.parentNode) waitBub.parentNode.removeChild(waitBub);
    if(!add.length){
      sys(readErr ? t('chat.openFail',{err:readErr}) : t('chat.noItems'));
      return;
    }
    var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
    var cond=S.ITEMS.filter(function(i){return i.state==='조건부';}).length;
    var no=S.ITEMS.length-ok-cond;
    sys(t('chat.parsed',{n:S.ITEMS.length,ok:ok,cond:cond,miss:no}));
    startQA();
  });
}

function startQA(){
  S.qQueue=buildQuestions(); S.qPos=0; S.MODE='qa'; S.finished=false;
  if(!S.qQueue.length) return finishAsk();
  sys(t('chat.qaIntro',{n:S.qQueue.length}));
  askQ();
}
function itemLine(n){
  var it=S.ITEMS[n-1]; if(!it) return '';
  return it.no+'. '+(it.grades.join(' / ')||t('chat.noGrade'))+' · '+shapeLabel(it.shape)+' · '+it.dim+
         (it.qty?' · '+it.qty:'');
}
function itemBlock(rows){
  if(!rows||!rows.length) return '';
  var head=rows.slice(0,4).map(itemLine).filter(Boolean).join('<br>');
  var more=rows.length>4 ? '<br>'+t('chat.rowsMore',{n:rows.length-4}) : '';
  return '<span class="mini" style="border-left:2px solid var(--molten);padding-left:8px;margin-top:8px">'+
         '<b style="color:var(--charcoal)">'+t('chat.rowsHead',{n:rows.length})+'</b><br>'+head+more+'</span>';
}
function askQ(){
  if(S.qPos>=S.qQueue.length) return askExtra();
  var r=S.qQueue[S.qPos];
  sys(t('chat.qHead',{i:S.qPos+1,n:S.qQueue.length,label:r.label,q:r.q})+itemBlock(r.rows));
  askIn.placeholder = r.ph || t('desk.inputPhAnswer');
  syncHero();
  chips(r.opts, function(v,label){ submit(v,label); });
}
/** value 는 기록·요청서용(한국어 식별자), display 는 말풍선에 보일 문구입니다. */
function submit(text, display){
  var v=(text||'').trim();
  if(!v) return;
  var shown=String(display==null?v:display);
  me(shown.replace(/[<>]/g,''));
  askChips.innerHTML='';
  if(S.MODE==='qa'){
    var r=S.qQueue[S.qPos];
    S.QLOG.push({label:r.label,q:r.q,a:v,rows:r.rows||[]});
    applyAnswer(r.k,v,r.rows);
    var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
    if(r.rows && r.rows.length){
      var changed=r.rows.filter(function(n){ return S.ITEMS[n-1] && S.ITEMS[n-1].state==='확정'; }).length;
      sys(t('chat.appliedRows',{rows:r.rows.length,changed:changed,ok:ok,all:S.ITEMS.length})+itemBlock(r.rows));
    } else {
      sys(t('chat.applied',{label:r.label,a:shown.replace(/[<>]/g,'')}));
    }
    S.qPos++;
    setTimeout(askQ,300);
  } else if(S.MODE==='extra'){
    S.ANS.extra=v;
    sys(t('chat.extraSaved',{a:shown.replace(/[<>]/g,'')}));
    setTimeout(finishAsk,300);
  } else if(S.MODE==='done'){
    S.ANS.memo=(S.ANS.memo?S.ANS.memo+' / ':'')+v;
    sys(t('chat.memoSaved'));
  } else {
    // 자유 입력 → 문장에서 품목 판독
    var add=[];
    v.split(/\r?\n|,\s*(?=[A-Za-z가-힣])/).forEach(function(l){ var it=parseLine(l); if(it) add.push(it); });
    if(add.length){
      S.ITEMS=S.ITEMS.concat(add); S.GAPS=diagnose(S.ITEMS); renderSpec(); hideDrop();
      sys(t('chat.parsedText',{n:add.length}));
      startQA();
    } else {
      S.ANS.memo=(S.ANS.memo?S.ANS.memo+' / ':'')+v;
      S.GAPS=S.GAPS||{noGrade:[],multiGrade:[],noLen:[],ambig:[],noQty:[],dup:[],aero:[]};
      sys(t('chat.freeMemo'));
      startQA();
    }
  }
  askIn.value='';
}
/** 필수 동의를 받지 않으면 보내지 않습니다 (DB 에도 동의 시각 없이는 들어가지 않습니다) */
function consentOk(){
  var req=document.getElementById('agreeReq'), box=document.getElementById('consent');
  if(!req || req.checked){ if(box) box.classList.remove('warn'); return true; }
  if(box){ box.classList.add('warn'); box.scrollIntoView({block:'nearest'}); }
  req.focus();
  return false;
}
document.getElementById('askSend').addEventListener('click',function(){
  if(!consentOk()) return;
  submit(askIn.value);
});
askIn.addEventListener('keydown',function(e){
  if(e.key!=='Enter') return;
  if(!consentOk()) return;
  submit(this.value);
});
var agreeReq=document.getElementById('agreeReq');
if(agreeReq) agreeReq.addEventListener('change',function(){
  if(this.checked) document.getElementById('consent').classList.remove('warn');
});


function askExtra(){
  S.MODE='extra';
  sys(t('chat.extraQ'));
  askIn.placeholder=t('desk.inputPhExtra');
  var vals=['없습니다','납기 조율 필요','대체 강종 상담','재단·가공 필요','다른 품목 추가'];
  var labels=t('chat.extraO');
  chips(vals.map(function(x,i){ return { v:x, t:(labels&&labels[i])||x }; }),function(v,label){
    S.ANS.extra = (v==='없습니다') ? '' : v;
    me(label);
    if(v==='다른 품목 추가'){
      sys(t('chat.extraMore'));
      S.MODE='free'; S.finished=false; return;
    }
    sys(v==='없습니다' ? t('chat.extraNone') : t('chat.extraNoted',{v:label}));
    setTimeout(finishAsk,300);
  });
}
/** 완료 블록 — 히어로 업로드 영역 바로 아래. 접수번호 · 전달 상태 · 버튼 2개 */
function openDoneBox(no){
  var box=document.getElementById('doneBox');
  if(!box) return;
  box.hidden=false;
  var noEl=document.getElementById('doneNo');
  if(noEl) noEl.textContent=no;
  var stEl=document.getElementById('doneState');
  var stWrap=box.querySelector('.donebox-state');
  function mark(text,done){
    if(stEl) stEl.textContent=text;
    if(stWrap) stWrap.classList.toggle('pending',!done);
  }
  mark(t('chat.statePending'),false);

  var dl=document.getElementById('dlRfq2');
  if(dl && !dl.dataset.on){
    dl.dataset.on='1';
    dl.addEventListener('click',function(){
      exportRfq();
      if(!S.SENT) mark(t('chat.stateDownloaded'),false);
    });
  }
  var send=document.getElementById('sendStaff');
  if(send && !send.dataset.on){
    send.dataset.on='1';
    send.addEventListener('click',function(){
      var btn=this; btn.disabled=true; btn.textContent=t('desk.sending');
      submitRfq().then(function(res){
        btn.disabled=false; btn.textContent=t('desk.send');
        if(res.mode==='db'){
          mark(t('chat.stateSent',{no:res.no}),true);
          sys(t('chat.okDb',{no:res.no}));
        } else {
          if(res.run) res.run();
          mark(t('chat.stateMail',{no:res.no}),false);
          sys(t('chat.okMail',{no:res.no}));
        }
        syncHero();
      });
    });
  }
}
function finishAsk(){
  if(S.finished) return; S.finished=true; S.MODE='done';
  var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
  var left=S.ITEMS.length-ok;
  var no='MB-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+String(Math.floor(Math.random()*899)+100);
  S.ANS.__no=no;
  var MSN=S.ITEMS.length? matchSuppliers() : [];
  var cnt={}; MSN.forEach(function(m){ cnt[m.sp.c]=(cnt[m.sp.c]||0)+1; });
  sys('<b>'+(S.ITEMS.length? t('chat.doneSend',{ok:ok}) : t('chat.doneNoItems'))+'</b>'+
      (MSN.length? '<span class="mini" style="border-left:2px solid var(--molten);padding-left:8px">'+
        '<b style="color:var(--charcoal)">'+t('chat.matchHead',{n:MSN.length,first:Math.min(8,MSN.length)})+'</b><br>'+
        Object.keys(cnt).map(function(k){return t('chat.countryN',{c:t('zone.'+CC[k]+'.ko')||k,n:cnt[k]});}).join(' · ')+'<br>'+
        MSN.slice(0,3).map(function(m){return m.sp.n+' ('+m.score+'%)';}).join('<br>')+
        (MSN.length>3?'<br>'+t('chat.matchMore',{n:MSN.length-3}):'')+'</span>' : '')+
      '<span class="mini">'+t('chat.doneNo',{no:no})+
      (S.ITEMS.length? '<br>'+t('chat.doneStat',{all:S.ITEMS.length,ok:ok})+
        (left?' · '+t('chat.doneLeft',{n:left}):'') : '')+
      '</span>'+
      (left? t('chat.tailLeft',{n:left}) : t('chat.tailAll')));
  sys(t('chat.steps'));
  openDoneBox(no);
  askIn.placeholder=t('desk.inputPhDone');
  chips([{v:'more',t:t('chat.moreFiles')}],function(){ S.MODE='free'; S.finished=false; fileInput.click(); });
  renderSpec();
  syncHero();
}
}
