/** 견적요청서 엑셀 생성 · 담당자 전달
 *
 *  받는 사람에 따라 시트를 나눕니다. 공급처 목록(시트 ②)은 담당자 전용입니다 —
 *  고객이 내려받는 파일에 넣지 마십시오 (CLAUDE.md · DB 작업 규칙).
 *
 *    exportRfq()          고객용  — 요청서 사본 · 판독 명세 · 접수 내역
 *    exportRfqSupplier()  공급처용 — 요청서 한 장만 (연락처·판독 근거 없음)
 *    exportRfqInternal()  담당자용 — 전부 (공급처 목록 포함)
 */
import * as XLSX from 'xlsx';
import { S, MB_MAIL } from '../state.js';
import { matchSuppliers, coverage, catOf, mtcOf } from './suppliers.js';
export function rfqNo(){
  if(!S.ANS.__no) S.ANS.__no='MB-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+String(Math.floor(Math.random()*899)+100);
  return S.ANS.__no;
}
export function pick(k){ return S.ANS[k]||''; }
/** 성적서 등급. 밀시트(EN 10204 3.1)는 기본이라 답이 없거나 모르셔도 빠지지 않습니다 —
 *  소개 화면의 "밀시트는 소재와 함께 나갑니다"가 요청서에서 지켜지는 자리입니다. */
export function mtcSpec(){
  var v=pick('mtc');
  return (!v || v==='모르겠습니다') ? '밀시트 (EN 10204 3.1)' : v;
}
export function summaryCounts(){
  var ok=S.ITEMS.filter(function(i){return i.state==='확정';}).length;
  var cond=S.ITEMS.filter(function(i){return i.state==='조건부';}).length;
  return {ok:ok,cond:cond,no:S.ITEMS.length-ok-cond,total:S.ITEMS.length};
}
function buildBook(mode){
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
  var rCond=Q.length; Q.push(['■ 요청 조건']);
  Q.push(['희망 납기',pick('due')||'협의','','인도 장소',pick('place')||'협의','','인도 조건',pick('incoterm')||'협의']);
  Q.push(['용도',pick('usage')||'미기재','','표면·마감',pick('finish')||'협의','','열처리·조질',pick('heat')||'지정 없음']);
  Q.push(['가공 범위',pick('fab')||'협의','','공차',pick('tol')||'일반 공차','','성적서',mtcSpec()]);
  Q.push(['원산지',pick('origin')||'무관','','발주 형태',pick('repeat')||'미정','','대체 강종','동등 이상 제안 가능']);
  Q.push(['통화',  'KRW 또는 USD','','결제 조건','협의','','','']);
  if(pick('extra')) Q.push(['추가 요청',pick('extra')]);
  Q.push([]);
  var rItems=Q.length; Q.push(['■ 견적 요청 품목  ('+sendable.length+'건)']);
  Q.push(['No','재질 / 강종','형상','치수 (mm)','수량','단위',
          '단가','금액','원산지','납기(주)','성적서','대체 제안','비고']);
  sendable.forEach(function(it,k){
    Q.push([k+1, it.grades.join(' / ')||'(협의)', it.shape, it.dim, it.qty||'', it.unit||pick('needUnit')||'EA',
            '','','','','','', it.issues.length? '확인 중: '+it.issues.join(' · '):'']);
  });
  if(!sendable.length){
    Q.push(['-','(품목 미확정 — 담당자가 고객과 확인 후 다시 보내드립니다)','','','','','','','','','','','']);
  }
  Q.push([]);
  Q.push(['합계','','','','','','','','','','','','']);
  Q.push([]);
  var rNote=Q.length; Q.push(['■ 회신 안내']);
  Q.push(['1. 음영 없는 회신란(단가·금액·원산지·납기·성적서·대체 제안)만 채워 회신해 주십시오.']);
  Q.push(['2. 전량 대응이 어려우신 경우 가능한 품목만 기재해 주셔도 됩니다.']);
  Q.push(['3. 동등 이상 강종으로 대체 제안이 가능하시면 대체 제안란에 기재해 주십시오.']);
  Q.push(['4. 위 요청 조건(표면·열처리·가공·공차·성적서·원산지·인도 조건)을 전제로 산출해 주십시오.']);
  Q.push(['5. 밀시트(MTC)는 전 품목 필수입니다. '+mtcSpec()+' 을(를) 소재와 함께 보내주십시오 — 원제조사 발행분 사본도 됩니다.']);
  Q.push(['6. 회신 기한: '+fmt(valid)+' · 회신처: '+MB_MAIL]);
  var wsQ=XLSX.utils.aoa_to_sheet(Q);
  wsQ['!cols']=[{wch:5},{wch:26},{wch:13},{wch:24},{wch:8},{wch:6},
                {wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:16},{wch:26}];
  wsQ['!merges']=[{s:{r:0,c:0},e:{r:0,c:12}},{s:{r:1,c:0},e:{r:1,c:12}},
                  {s:{r:rCond,c:0},e:{r:rCond,c:12}},
                  {s:{r:rItems,c:0},e:{r:rItems,c:12}},
                  {s:{r:rNote,c:0},e:{r:rNote,c:12}}];
  XLSX.utils.book_append_sheet(wb,wsQ,'① 견적요청서(발송용)');
  if(mode==='supplier') return { wb:wb, no:no };   // 공급처에는 이 한 장만

  /* ══ 2. 발송처 목록 — 담당자 전용. 고객 파일에 넣지 마십시오 ══ */
  if(mode==='internal'){
  var E=[['견적 요청 발송처 목록'],['요청번호',no,'','후보 공급처',MS.length+'곳'],
         ['※ 판독된 소재·형상에 따라 자동 선정된 실존 제조사·유통사입니다. 현재 거래 이력은 없으며 접촉 대상 후보입니다.'],[],
         ['No','적합도','국가','지역','유형','공급처','취급 소재','취급 형상',
          '최소수량','리드타임','밀시트','대응 품목','거래 상태','발송','발송일','회신일','회신 단가','납기','비고']];
  MS.forEach(function(m,k){
    E.push([k+1, m.score+'%', m.sp.c, m.sp.r, m.sp.t, m.sp.n,
            m.cats.join(' · '), m.sp.sh.join(' · '), m.sp.moq, m.sp.lead, mtcOf(m.sp),
            m.items.length>6 ? m.items.slice(0,6).join(', ')+' 외 '+(m.items.length-6)+'건' : m.items.join(', '),
            '후보(미거래)', (k<8?'1차':'2차'),'','','','', m.sp.note]);
  });
  E.push([]);
  var byC={}; MS.forEach(function(m){ byC[m.sp.c]=(byC[m.sp.c]||0)+1; });
  E.push(['국가별 분포',Object.keys(byC).map(function(k){return k+' '+byC[k]+'곳';}).join(' · ')]);
  E.push(['발송 원칙','적합도 상위 8곳을 1차 발송 · 회신 상황을 보아 2차 발송']);
  var wsE=XLSX.utils.aoa_to_sheet(E);
  wsE['!cols']=[{wch:5},{wch:8},{wch:9},{wch:12},{wch:10},{wch:28},{wch:18},{wch:26},
                {wch:9},{wch:10},{wch:15},{wch:22},{wch:12},{wch:7},{wch:11},{wch:11},{wch:13},{wch:10},{wch:24}];
  wsE['!merges']=[{s:{r:0,c:0},e:{r:0,c:18}},{s:{r:2,c:0},e:{r:2,c:18}}];
  wsE['!autofilter']={ref:'A5:S'+(5+MS.length)};
  XLSX.utils.book_append_sheet(wb,wsE,'② 발송처목록');
  }

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
         ['인도 조건',pick('incoterm')||'-','','발주 형태',pick('repeat')||'-'],
         ['용도',pick('usage')||'-','','표면·마감',pick('finish')||'-'],
         ['열처리·조질',pick('heat')||'-','','가공 범위',pick('fab')||'-'],
         ['공차',pick('tol')||'-','','원산지',pick('origin')||'-'],
         ['성적서',mtcSpec(),'','추가 요청',pick('extra')||pick('memo')||'-'],
         [],
         ['■ 판독 요약'],
         ['총 품목',c.total+'건','','발송 가능',c.ok+'건'],
         ['확인 후 가능',c.cond+'건','','추가 확인 필요',c.no+'건'],
         ['발송 후보',MS.length+'곳','','현재 상태',
           !S.ITEMS.length ? '품목 미확정 — 담당자 확인 필요'
             : (c.no>0?'확인 중 (일부 발송 가능)':'발송 준비 완료')],
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

  return { wb:wb, no:no };
}

const SUFFIX = { customer:'', supplier:'_발송용', internal:'_내부용' };
function save(mode){
  var r=buildBook(mode);
  XLSX.writeFile(r.wb, 'METALBRIDGE_'+r.no+SUFFIX[mode]+'.xlsx');
}

/** 고객용 — 공급처 목록은 들어가지 않습니다 */
export function exportRfq(){ save('customer'); }
/** 공급처 발송용 — 요청서 한 장. 연락처·판독 근거 없음 */
export function exportRfqSupplier(){ save('supplier'); }
/** 담당자용 — 공급처 목록 포함. 백오피스에서만 쓰십시오 */
export function exportRfqInternal(){ save('internal'); }

/* ── 담당자 전달 (메일) ── */
