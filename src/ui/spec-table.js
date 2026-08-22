/** 판독 결과 표 — DOM 훅: #specBody, #specMeta */
import { S } from '../state.js';
import { exportRfq } from '../engine/export-rfq.js';
export function badge(st){
  var cls = st==='확정'?'ok':(st==='조건부'?'warn':'miss');
  return '<span class="tag '+cls+'">'+st+'</span>';
}
export function renderSpec(){
  var body=document.getElementById('specBody');
  if(!S.ITEMS.length){
    body.innerHTML='<div class="empty"><div><div class="big">NO FILE</div>'+
      '<p style="margin-top:10px">위 문의창에서 자료를 보내주시면<br>판독 결과가 여기에 표시됩니다.</p></div></div>';
    return;
  }
  var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
  var cond=S.ITEMS.filter(function(i){return i.state==='조건부';}).length;
  var no=S.ITEMS.filter(function(i){return i.state==='불가';}).length;
  document.getElementById('specMeta').textContent =
    '품목 '+S.ITEMS.length+'건 · 확정 '+ok+' · 조건부 '+cond+' · 확인 필요 '+no;
  var h='<div class="spec-wrap"><table class="spec"><thead><tr>'+
    '<th>No</th><th>재질</th><th>형상</th><th>치수</th><th>수량</th><th>판독</th><th>원문</th></tr></thead><tbody>';
  S.ITEMS.forEach(function(it){
    h+='<tr><td class="mono" data-l="No">'+it.no+'</td>'+
       '<td data-l="재질"><div class="m">'+(it.grades.join(' / ')||'(미기재)')+'</div>'+
       (it.note?'<div class="sub" style="color:var(--success)">'+it.note+'</div>':'')+'</td>'+
       '<td data-l="형상">'+it.shape+'</td>'+
       '<td class="mono" data-l="치수">'+it.dim+(it.lenNote?'<div class="sub">'+it.lenNote+'</div>':'')+'</td>'+
       '<td class="mono" data-l="수량">'+(it.qty||'—')+'</td>'+
       '<td data-l="판독">'+badge(it.state)+(it.issues.length?'<div class="sub">'+it.issues.join(' · ')+'</div>':'')+'</td>'+
       '<td class="sub" data-l="원문" style="max-width:220px">'+it.raw.slice(0,60).replace(/[<>]/g,'')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:var(--lg);align-items:center">'+
     '<button class="btn btn-primary btn-sm" id="dlRfq">요청서 내려받기 (엑셀)</button>'+
     '<span class="cap" style="font-size:12.5px">확정 '+ok+'건은 지금 상태로 공급망에 보낼 수 있습니다.</span></div>';
  body.innerHTML=h;
  var dl=document.getElementById('dlRfq');
  if(dl) dl.addEventListener('click',exportRfq);
}
