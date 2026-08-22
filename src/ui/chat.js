/** 업로드 · 대화 흐름
 *  DOM 훅: #drop #fileInput #askLog #askChips #askIn #askSend #askAttach
 */
import { S, reduce } from '../state.js';
import { parseLine, diagnose } from '../engine/parse.js';
import { linesFromFile } from '../engine/read-file.js';
import { matchSuppliers } from '../engine/suppliers.js';
import { exportRfq, rfqNo } from '../engine/export-rfq.js';
import { submitRfq } from '../engine/submit.js';
import { renderSpec } from './spec-table.js';
import { buildQuestions, applyAnswer } from './questions.js';
import { syncHero } from './misc.js';
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
function sys(html){ return bub('sys','METAL BRIDGE',html); }
function me(html){ return bub('me','고객사',html); }
function chips(list,fn){
  askChips.innerHTML='';
  (list||[]).forEach(function(o){
    var b=document.createElement('button');
    b.type='button'; b.textContent=o;
    b.addEventListener('click',function(){ askChips.innerHTML=''; fn(o); });
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
  var wait=sys('자료를 읽고 있습니다…');
  startRead(real, wait);
}

function startRead(files, waitBub){
  var status=document.getElementById('upState');
  if(status) status.textContent='판독 중';
  var readErr=null;
  var jobs=Array.prototype.map.call(files,function(f){
    return linesFromFile(f).catch(function(e){ readErr=(f.name+' — '+(e&&e.message||'읽기 실패')); return []; });
  });
  Promise.all(jobs).then(function(all){
    var lines=[].concat.apply([],all);
    var add=[];
    lines.forEach(function(l){ var it=parseLine(l); if(it) add.push(it); });
    S.ITEMS=S.ITEMS.concat(add);
    S.GAPS=diagnose(S.ITEMS);
    renderSpec();
    syncHero();
    if(status) status.textContent = S.ITEMS.length? '판독 완료' : '확인 필요';
    if(waitBub && waitBub.parentNode) waitBub.parentNode.removeChild(waitBub);
    if(!add.length){
      sys(readErr ? '자료를 여는 데 실패했습니다.<span class="mini">'+readErr+'</span>담당자가 직접 열어 확인하겠습니다. 필요하신 소재를 한 줄로 적어주셔도 됩니다.'
                  : '자료에서 품목을 찾지 못했습니다. 필요하신 소재와 조건을 적어주시면 담당자가 확인하겠습니다.');
      return;
    }
    var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
    var cond=S.ITEMS.filter(function(i){return i.state==='조건부';}).length;
    var no=S.ITEMS.length-ok-cond;
    sys('<b>'+S.ITEMS.length+'개 품목을 읽었습니다.</b>'+
        '<span class="mini">바로 견적 가능 '+ok+'건 · 확인하면 가능 '+cond+'건 · 확인 필요 '+no+'건<br>'+
        '아래 판독표에서 항목별로 보실 수 있습니다.</span>');
    startQA();
  });
}

function startQA(){
  S.qQueue=buildQuestions(); S.qPos=0; S.MODE='qa'; S.finished=false;
  if(!S.qQueue.length) return finishAsk();
  sys('견적을 받으려면 '+S.qQueue.length+'가지만 확인하면 됩니다. 하나씩 여쭙겠습니다.');
  askQ();
}
function itemLine(n){
  var it=S.ITEMS[n-1]; if(!it) return '';
  return it.no+'. '+(it.grades.join(' / ')||'(강종 미기재)')+' · '+it.shape+' · '+it.dim+
         (it.qty?' · '+it.qty:'');
}
function itemBlock(rows){
  if(!rows||!rows.length) return '';
  var head=rows.slice(0,4).map(itemLine).filter(Boolean).join('<br>');
  var more=rows.length>4 ? '<br>외 '+(rows.length-4)+'건' : '';
  return '<span class="mini" style="border-left:2px solid var(--molten);padding-left:8px;margin-top:8px">'+
         '<b style="color:var(--charcoal)">해당 품목 '+rows.length+'건</b><br>'+head+more+'</span>';
}
function askQ(){
  if(S.qPos>=S.qQueue.length) return askExtra();
  var r=S.qQueue[S.qPos];
  sys('<b>'+(S.qPos+1)+'/'+S.qQueue.length+' · '+r.label+'</b><span class="mini">'+r.q+'</span>'+itemBlock(r.rows));
  askIn.placeholder = r.ph || '답변을 입력해 주십시오';
  syncHero();
  chips(r.opts, function(v){ submit(v); });
}
function submit(text){
  var t=(text||'').trim();
  if(!t) return;
  me(t.replace(/[<>]/g,''));
  askChips.innerHTML='';
  if(S.MODE==='qa'){
    var r=S.qQueue[S.qPos];
    S.QLOG.push({label:r.label,q:r.q,a:t,rows:r.rows||[]});
    applyAnswer(r.k,t,r.rows);
    var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
    if(r.rows && r.rows.length){
      var changed=r.rows.filter(function(n){ return S.ITEMS[n-1] && S.ITEMS[n-1].state==='확정'; }).length;
      sys('<b>반영했습니다.</b><span class="mini">'+r.rows.length+'개 품목에 적용 · 그중 '+changed+
          '건이 발송 가능 상태가 됐습니다<br>전체 발송 가능 '+ok+' / '+S.ITEMS.length+'건</span>'+itemBlock(r.rows));
    } else {
      sys('<b>반영했습니다.</b><span class="mini">'+r.label+' — '+t.replace(/[<>]/g,'')+'</span>');
    }
    S.qPos++;
    setTimeout(askQ,300);
  } else if(S.MODE==='extra'){
    S.ANS.extra=t;
    sys('<b>확인했습니다.</b><span class="mini">'+t.replace(/[<>]/g,'')+' — 요청서에 함께 기재합니다.</span>');
    setTimeout(finishAsk,300);
  } else if(S.MODE==='done'){
    S.ANS.memo=(S.ANS.memo?S.ANS.memo+' / ':'')+t;
    sys('전달하겠습니다.<span class="mini">담당자가 요청서에 함께 반영합니다.</span>');
  } else {
    // 자유 입력 → 문장에서 품목 판독
    var add=[];
    t.split(/\r?\n|,\s*(?=[A-Za-z가-힣])/).forEach(function(l){ var it=parseLine(l); if(it) add.push(it); });
    if(add.length){
      S.ITEMS=S.ITEMS.concat(add); S.GAPS=diagnose(S.ITEMS); renderSpec(); hideDrop();
      sys('<b>'+add.length+'개 품목으로 읽었습니다.</b><span class="mini">아래 판독표에서 확인하실 수 있습니다.</span>');
      startQA();
    } else {
      S.ANS.memo=(S.ANS.memo?S.ANS.memo+' / ':'')+t;
      S.GAPS=S.GAPS||{noGrade:[],multiGrade:[],noLen:[],ambig:[],noQty:[],dup:[],aero:[]};
      sys('내용을 접수했습니다. 몇 가지만 확인하겠습니다.');
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
  sys('<b>마지막으로 여쭙겠습니다.</b><span class="mini">견적 외에 함께 의논하실 내용이 있으십니까?</span>');
  askIn.placeholder='예) 재단 가공도 함께 필요합니다';
  chips(['없습니다','납기 조율 필요','대체 강종 상담','재단·가공 필요','다른 품목 추가'],function(v){
    S.ANS.extra = (v==='없습니다') ? '' : v;
    me(v);
    if(v==='다른 품목 추가'){
      sys('추가하실 자료를 올려주시거나 품목을 적어주십시오.');
      S.MODE='free'; S.finished=false; return;
    }
    sys(v==='없습니다' ? '확인했습니다.' : '<b>'+v+'</b><span class="mini">요청서에 함께 기재해 담당자에게 전달합니다.</span>');
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
  mark('아직 전달되지 않았습니다',false);

  var dl=document.getElementById('dlRfq2');
  if(dl && !dl.dataset.on){
    dl.dataset.on='1';
    dl.addEventListener('click',function(){
      exportRfq();
      if(!S.SENT) mark('요청서를 내려받았습니다 · 아직 전달되지 않았습니다',false);
    });
  }
  var send=document.getElementById('sendStaff');
  if(send && !send.dataset.on){
    send.dataset.on='1';
    send.addEventListener('click',function(){
      var btn=this; btn.disabled=true; btn.textContent='전송 중…';
      submitRfq().then(function(res){
        btn.disabled=false; btn.textContent='담당자에게 보내기';
        if(res.mode==='db'){
          mark('한국 · 중국 · 일본 · 인도 발송 준비 완료 · '+res.no,true);
          sys('<b>담당자에게 접수되었습니다.</b><span class="mini">접수번호 '+res.no+
              '<br>올려주신 자료와 판독 결과가 함께 저장됐습니다. 담당자가 사양을 확인한 뒤 연락드립니다.</span>');
        } else {
          if(res.run) res.run();
          mark('메일 앱으로 전환했습니다 · '+res.no,false);
          sys('<b>메일로 전달합니다.</b><span class="mini">접수번호 '+res.no+
              '<br>메일 앱이 열리면 요청서 파일을 첨부해 보내 주십시오.</span>');
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
  sys('<b>'+(S.ITEMS.length? ok+'건을 공급망에 보냅니다.' : '문의를 접수했습니다.')+'</b>'+
      (MSN.length? '<span class="mini" style="border-left:2px solid var(--molten);padding-left:8px">'+
        '<b style="color:var(--charcoal)">후보 공급처 '+MSN.length+'곳 · 1차 발송 '+Math.min(8,MSN.length)+'곳</b><br>'+
        Object.keys(cnt).map(function(k){return k+' '+cnt[k]+'곳';}).join(' · ')+'<br>'+
        MSN.slice(0,3).map(function(m){return m.sp.n+' ('+m.score+'%)';}).join('<br>')+
        (MSN.length>3?'<br>외 '+(MSN.length-3)+'곳':'')+'</span>' : '')+
      '<span class="mini">접수번호 '+no+
      (S.ITEMS.length? '<br>판독 '+S.ITEMS.length+'건 · 발송 가능 '+ok+'건'+(left?' · 추가 확인 '+left+'건':'') : '')+
      '</span>'+
      (left? '남은 '+left+'건은 담당자가 자료를 열어 확인한 뒤 다시 여쭙겠습니다.'
           : '요청서를 만들어 한국·중국·일본·인도 공급처에 보냅니다.'));
  sys('<b>남은 절차는 두 가지입니다.</b>'+
    '<span class="mini">위 업로드 영역 아래의 완료 블록에서 ① 요청서를 내려받아 보관하시고<br>'+
    '② 담당자에게 보내기를 눌러 주십시오. 보내기를 누르셔야 전달됩니다.</span>');
  openDoneBox(no);
  askIn.placeholder='추가로 하실 말씀이 있으면 적어주십시오';
  chips(['자료 더 올리기'],function(){ S.MODE='free'; S.finished=false; fileInput.click(); });
  renderSpec();
  syncHero();
}
}
