/** 결손 → 질문 생성 · 답변 반영 */
import { S } from '../state.js';
import { renderSpec } from './spec-table.js';
export function buildQuestions(){
  var qs=[];
  if(!S.ANS.contact)
    qs.push({k:'contact',label:'연락처',q:'회신받으실 연락처를 알려주십시오.',ph:'이메일 또는 휴대폰',opts:[]});
  if(S.GAPS.ambig.length)
    qs.push({k:'dimdef',label:'치수 열 정의',
      q:'숫자만 나열된 품목이 '+S.GAPS.ambig.length+'건 있습니다. 앞의 숫자가 길이입니까, 두께입니까?',
      ph:'',opts:['길이(Length)','두께(Thickness)','외경/내경 순서','모르겠습니다'],rows:S.GAPS.ambig});
  if(S.GAPS.noLen.length)
    qs.push({k:'length',label:'길이',
      q:'형강·강관 '+S.GAPS.noLen.length+'건에 길이가 없습니다. 어떻게 받으시겠습니까?',
      ph:'예) 정척 6m',opts:['정척 6m 기준','재단 길이 별도 지정','길이 확인 후 회신'],rows:S.GAPS.noLen});
  if(S.GAPS.noGrade.length)
    qs.push({k:'grade',label:'강종',
      q:'강종 표기가 없는 품목이 '+S.GAPS.noGrade.length+'건 있습니다. 어떤 강종입니까?',
      ph:'예) S355 / SS400 / SM490',opts:['S355','SS400','SM490','모르겠습니다'],rows:S.GAPS.noGrade});
  if(S.GAPS.multiGrade.length)
    qs.push({k:'grade2',label:'강종 병기',
      q:'강종이 두 개로 적힌 품목이 '+S.GAPS.multiGrade.length+'건 있습니다. 어느 쪽 기준입니까?',
      ph:'',opts:['앞의 강종','뒤의 강종','둘 다 견적'],rows:S.GAPS.multiGrade});
  if(S.GAPS.aero.length)
    qs.push({k:'aero',label:'인증 요구',
      q:'항공 등급 합금('+S.GAPS.aero.length+'건)이 포함돼 있습니다. 인증이 필요하십니까?',
      ph:'',opts:['일반 산업용 (인증 불요)','AMS·EN 인증 필요','확인 후 회신'],rows:S.GAPS.aero});
  if(S.GAPS.dup.length)
    qs.push({k:'dup',label:'중복 확인',
      q:'치수가 같은 품목이 '+S.GAPS.dup.length+'건 있습니다. 별건입니까?',
      ph:'',opts:['별건입니다','중복 기재 — 하나만','수량을 합쳐주십시오'],rows:S.GAPS.dup});
  qs.push({k:'due',label:'희망 납기',q:'언제까지 필요하십니까.',ph:'예) 10월 중순',
    opts:['2주 이내','1개월 이내','2개월 이상','미정']});
  qs.push({k:'place',label:'인도 장소',q:'어디로 받으시겠습니까.',ph:'예) 부산 강서 공장',opts:[]});
  qs.push({k:'mtc',label:'성적서',q:'밀시트(제조사 성적서)가 필요하십니까.',ph:'',
    opts:['필요합니다','불필요','모르겠습니다']});
  return qs;
}

export function applyAnswer(k,v,rows){
  S.ANS[k]=v;
  if(!rows) return;
  rows.forEach(function(n){
    var it=S.ITEMS[n-1]; if(!it) return;
    if(k==='dimdef'){
      it.issues=it.issues.filter(function(s){return s!=='치수 열 정의 불명';});
      it.lenNote='첫 값 = '+v;
    }
    if(k==='length'){
      it.issues=it.issues.filter(function(s){return s!=='길이 미기재';});
      it.lenNote=v;
    }
    if(k==='grade'&&v!=='모르겠습니다'){
      it.issues=it.issues.filter(function(s){return s!=='강종 미기재';});
      it.grades=[v]; it.note='고객 확인';
    }
    if(k==='grade2'){
      it.issues=it.issues.filter(function(s){return s!=='강종 2개 병기';});
      if(v==='앞의 강종') it.grades=[it.grades[0]];
      else if(v==='뒤의 강종') it.grades=[it.grades[it.grades.length-1]];
      it.note='고객 확인';
    }
    if(k==='dup'&&v!=='별건입니다'){
      it.issues=it.issues.filter(function(s){return s.indexOf('중복')<0;});
      it.note=v;
    }
    it.state = it.issues.length===0 ? '확정' : (it.issues.some(function(s){
      return s==='길이 미기재'||s==='강종 미기재'; }) ? '불가' : '조건부');
  });
  renderSpec();
}
