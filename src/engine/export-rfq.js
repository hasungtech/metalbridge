/** 견적요청서 엑셀 생성 (4시트) · 담당자 전달 */
import * as XLSX from 'xlsx';
import { S, MB_MAIL } from '../state.js';
import { matchSuppliers, coverage, catOf } from './suppliers.js';
export function rfqNo(){
  if(!S.ANS.__no) S.ANS.__no='MB-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+String(Math.floor(Math.random()*899)+100);
  return S.ANS.__no;
}
export function pick(k){ return S.ANS[k]||''; }
export function summaryCounts(){
  var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
  var cond=S.ITEMS.filter(function(i){return i.state==='조건부';}).length;
  return {ok:ok,cond:cond,no:S.ITEMS.length-ok-cond,total:S.ITEMS.length};
}
export function exportRfq(){
  var no=rfqNo(), c=summaryCounts(), MS=matchSuppliers(), CV=coverage();
  var wb=XLSX.utils.book_new();
  var today=new Date(), valid=new Date(today.getTime()+14*86400000);
  var fmt=function(d){ return d.toISOString().slice(0,10); };
  var sendable=S.ITEMS.filter(function(i){return i.state!=='불가';});

  /* ══ 1. 견적요청서 (공급처 발송용) ══ */
  var Q=[];
  Q.push(['REQUEST FOR QUOTATION · 견적 요청서']);
  Q.push(['METAL BRIDGE  |  운영 Grit Corporation']);
  Q.push([]);
  Q.push(['요청번호',no,'','발행일',fmt(today),'','회신 기한',fmt(valid)]);
  Q.push(['수신 (공급처)','','','담당자','','','연락처','']);
  Q.push(['발신','METAL BRIDGE 소싱팀','','연락처',MB_MAIL,'','','']);
  Q.push([]);
  Q.push(['■ 요청 조건']);
  Q.push(['희망 납기',pick('due')||'협의','','인도 장소',pick('place')||'협의','','통화 / 인도조건','KRW 또는 USD · 협의']);
  Q.push(['성적서',pick('mtc')||'협의','','대체 강종','동등 이상 제안 가능','','결제 조건','협의']);
  if(pick('extra')) Q.push(['추가 요청',pick('extra')]);
  Q.push([]);
  Q.push(['■ 견적 요청 품목  ('+sendable.length+'건)']);
  Q.push(['No','재질 / 강종','형상','치수 (mm)','수량','단위',
          '단가','금액','원산지','납기(주)','성적서','대체 제안','비고']);
  sendable.forEach(function(it,k){
    Q.push([k+1, it.grades.join(' / ')||'(협의)', it.shape, it.dim, it.qty||'', 'EA',
            '','','','','','', it.issues.length? '확인 중: '+it.issues.join(' · '):'']);
  });
  Q.push([]);
  Q.push(['합계','','','','','','','','','','','','']);
  Q.push([]);
  Q.push(['■ 회신 안내']);
  Q.push(['1. 음영 없는 회신란(단가·금액·원산지·납기·성적서·대체 제안)만 채워 회신해 주십시오.']);
  Q.push(['2. 전량 대응이 어려우신 경우 가능한 품목만 기재해 주셔도 됩니다.']);
  Q.push(['3. 동등 이상 강종으로 대체 제안이 가능하시면 대체 제안란에 기재해 주십시오.']);
  Q.push(['4. 회신 기한: '+fmt(valid)+' · 회신처: '+MB_MAIL]);
  var wsQ=XLSX.utils.aoa_to_sheet(Q);
  wsQ['!cols']=[{wch:5},{wch:26},{wch:13},{wch:24},{wch:8},{wch:6},
                {wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:16},{wch:26}];
  wsQ['!merges']=[{s:{r:0,c:0},e:{r:0,c:12}},{s:{r:1,c:0},e:{r:1,c:12}},
                  {s:{r:7,c:0},e:{r:7,c:12}},{s:{r:11,c:0},e:{r:11,c:12}}];
  XLSX.utils.book_append_sheet(wb,wsQ,'① 견적요청서(발송용)');

  /* ══ 2. 발송처 목록 ══ */
  var E=[['견적 요청 발송처 목록'],['요청번호',no,'','후보 공급처',MS.length+'곳'],
         ['※ 판독된 소재·형상에 따라 자동 선정된 실존 제조사·유통사입니다. 현재 거래 이력은 없으며 접촉 대상 후보입니다.'],[],
         ['No','적합도','국가','지역','유형','공급처','취급 소재','취급 형상',
          '최소수량','리드타임','대응 품목','거래 상태','발송','발송일','회신일','회신 단가','납기','비고']];
  MS.forEach(function(m,k){
    E.push([k+1, m.score+'%', m.sp.c, m.sp.r, m.sp.t, m.sp.n,
            m.cats.join(' · '), m.sp.sh.join(' · '), m.sp.moq, m.sp.lead,
            m.items.length>6 ? m.items.slice(0,6).join(', ')+' 외 '+(m.items.length-6)+'건' : m.items.join(', '),
            '후보(미거래)', (k<8?'1차':'2차'),'','','','', m.sp.note]);
  });
  E.push([]);
  var byC={}; MS.forEach(function(m){ byC[m.sp.c]=(byC[m.sp.c]||0)+1; });
  E.push(['국가별 분포',Object.keys(byC).map(function(k){return k+' '+byC[k]+'곳';}).join(' · ')]);
  E.push(['발송 원칙','적합도 상위 8곳을 1차 발송 · 48시간 내 회신 부족 시 2차 발송']);
  var wsE=XLSX.utils.aoa_to_sheet(E);
  wsE['!cols']=[{wch:5},{wch:8},{wch:9},{wch:12},{wch:10},{wch:28},{wch:18},{wch:26},
                {wch:9},{wch:10},{wch:22},{wch:12},{wch:7},{wch:11},{wch:11},{wch:13},{wch:10},{wch:24}];
  wsE['!merges']=[{s:{r:0,c:0},e:{r:0,c:17}},{s:{r:2,c:0},e:{r:2,c:17}}];
  wsE['!autofilter']={ref:'A5:R'+(5+MS.length)};
  XLSX.utils.book_append_sheet(wb,wsE,'② 발송처목록');

  /* ══ 3. 판독 명세 (내부) ══ */
  var B=[['판독 명세 (내부용)'],['요청번호',no],[],
         ['No','재질','소재 구분','형상','치수','수량','판독 상태','확인 필요 사항','원문']];
  S.ITEMS.forEach(function(it){
    B.push([it.no,it.grades.join(' / ')||'(미기재)',catOf((it.grades||[]).join(' ')),
            it.shape,it.dim,it.qty||'',it.state,it.issues.join(' · ')||'-',it.raw]);
  });
  var ws2=XLSX.utils.aoa_to_sheet(B);
  ws2['!cols']=[{wch:5},{wch:24},{wch:13},{wch:13},{wch:22},{wch:7},{wch:10},{wch:30},{wch:52}];
  ws2['!merges']=[{s:{r:0,c:0},e:{r:0,c:8}}];
  ws2['!autofilter']={ref:'A4:I'+(4+S.ITEMS.length)};
  XLSX.utils.book_append_sheet(wb,ws2,'③ 판독명세');

  /* ══ 4. 접수·확인 내역 ══ */
  var A=[['접수 정보 및 고객 확인 내역'],['요청번호',no],[],
         ['■ 접수 정보'],
         ['접수일시',new Date().toLocaleString('ko-KR'),'','접수 경로','웹 견적 문의'],
         ['연락처',pick('contact'),'','첨부 자료',S.picked.length+'건'],
         ['희망 납기',pick('due'),'','인도 장소',pick('place')],
         ['성적서',pick('mtc'),'','추가 요청',pick('extra')||pick('memo')||'-'],
         [],
         ['■ 판독 요약'],
         ['총 품목',c.total+'건','','발송 가능',c.ok+'건'],
         ['확인 후 가능',c.cond+'건','','추가 확인 필요',c.no+'건'],
         ['발송 후보',MS.length+'곳','','현재 상태',c.no>0?'확인 중 (일부 발송 가능)':'발송 준비 완료'],
         [],
         ['■ 소재별 공급처 확보 현황'],
         ['소재 구분','후보 공급처','국가 분포','국내 공급처']];
  CV.forEach(function(r){ A.push([r.cat,r.total+'곳',r.dist,r.dom+'곳']); });
  A.push([]);
  A.push(['■ 고객 확인 내역']);
  A.push(['순번','확인 항목','질문','고객 답변','적용 품목']);
  S.QLOG.forEach(function(q,k){
    A.push([k+1,q.label,q.q,q.a,(q.rows&&q.rows.length)?q.rows.join(', ')+'번':'전체']);
  });
  if(!S.QLOG.length) A.push(['-','-','확인 문답 없음','-','-']);
  var ws1=XLSX.utils.aoa_to_sheet(A);
  ws1['!cols']=[{wch:16},{wch:30},{wch:34},{wch:26},{wch:22}];
  ws1['!merges']=[{s:{r:0,c:0},e:{r:0,c:4}}];
  XLSX.utils.book_append_sheet(wb,ws1,'④ 접수·확인내역');

  XLSX.writeFile(wb,'METALBRIDGE_'+no+'.xlsx');
}

/* ── 담당자 전달 (메일) ── */
export function buildMailBody(){
  var no=rfqNo(), c=summaryCounts(), L=[];
  L.push('[METAL BRIDGE 견적 문의] '+no);
  L.push('');
  L.push('연락처: '+pick('contact'));
  L.push('희망 납기: '+pick('due')+' / 인도 장소: '+pick('place'));
  L.push('성적서: '+pick('mtc'));
  if(pick('extra')) L.push('추가 요청: '+pick('extra'));
  L.push('');
  L.push('판독 결과: 총 '+c.total+'건 (발송 가능 '+c.ok+' · 확인 후 '+c.cond+' · 확인 필요 '+c.no+')');
  L.push('');
  L.push('■ 품목');
  S.ITEMS.slice(0,15).forEach(function(it){
    L.push(it.no+'. '+(it.grades.join('/')||'(미기재)')+' | '+it.shape+' | '+it.dim+' | '+(it.qty||'-')+' | '+it.state);
  });
  if(S.ITEMS.length>15) L.push('... 외 '+(S.ITEMS.length-15)+'건 (첨부 파일 참조)');
  L.push('');
  L.push('■ 확인 내역');
  S.QLOG.forEach(function(q){ L.push('- '+q.label+': '+q.a); });
  L.push('');
  L.push('※ 내려받은 요청서 엑셀 파일을 이 메일에 첨부해 주십시오.');
  return L.join('\n');
}

