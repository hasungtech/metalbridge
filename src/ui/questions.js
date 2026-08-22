/** 결손 → 질문 생성 · 답변 반영
 *
 *  선택지는 `{v, t}` 입니다.
 *   v — 한국어 식별자. `applyAnswer` 의 비교와 요청서·DB 에 그대로 들어갑니다
 *   t — 화면에 보이는 문구. 언어에 따라 바뀝니다
 *  v 를 번역하면 아래 비교문이 전부 어긋나고 담당자가 받는 요청서도 언어별로 갈라집니다.
 */
import { S } from '../state.js';
import { renderSpec } from './spec-table.js';
import { t } from '../i18n/index.js';

/** 한국어 식별자 배열 + 사전 키 → [{v,t}] */
function opts(values, key) {
  var labels = t(key);
  return values.map(function (v, i) {
    return { v: v, t: (Array.isArray(labels) && labels[i]) || v };
  });
}

export function buildQuestions(){
  var qs=[];
  if(!S.ANS.contact)
    qs.push({k:'contact',label:t('q.contactL'),q:t('q.contactQ'),ph:t('q.contactPh'),opts:[]});
  if(S.GAPS.ambig.length)
    qs.push({k:'dimdef',label:t('q.dimdefL'),
      q:t('q.dimdefQ',{n:S.GAPS.ambig.length}),ph:'',
      opts:opts(['길이(Length)','두께(Thickness)','외경/내경 순서','모르겠습니다'],'q.dimdefO'),
      rows:S.GAPS.ambig});
  if(S.GAPS.noLen.length)
    qs.push({k:'length',label:t('q.lengthL'),
      q:t('q.lengthQ',{n:S.GAPS.noLen.length}),ph:t('q.lengthPh'),
      opts:opts(['정척 6m 기준','재단 길이 별도 지정','길이 확인 후 회신'],'q.lengthO'),
      rows:S.GAPS.noLen});
  if(S.GAPS.noGrade.length)
    qs.push({k:'grade',label:t('q.gradeL'),
      q:t('q.gradeQ',{n:S.GAPS.noGrade.length}),ph:t('q.gradePh'),
      opts:opts(['S355','SS400','SM490','모르겠습니다'],'q.gradeO'),
      rows:S.GAPS.noGrade});
  if(S.GAPS.multiGrade.length)
    qs.push({k:'grade2',label:t('q.grade2L'),
      q:t('q.grade2Q',{n:S.GAPS.multiGrade.length}),ph:'',
      opts:opts(['앞의 강종','뒤의 강종','둘 다 견적'],'q.grade2O'),
      rows:S.GAPS.multiGrade});
  if(S.GAPS.aero.length)
    qs.push({k:'aero',label:t('q.aeroL'),
      q:t('q.aeroQ',{n:S.GAPS.aero.length}),ph:'',
      opts:opts(['일반 산업용 (인증 불요)','AMS·EN 인증 필요','확인 후 회신'],'q.aeroO'),
      rows:S.GAPS.aero});
  if(S.GAPS.dup.length)
    qs.push({k:'dup',label:t('q.dupL'),
      q:t('q.dupQ',{n:S.GAPS.dup.length}),ph:'',
      opts:opts(['별건입니다','중복 기재 — 하나만','수량을 합쳐주십시오'],'q.dupO'),
      rows:S.GAPS.dup});
  qs.push({k:'due',label:t('q.dueL'),q:t('q.dueQ'),ph:t('q.duePh'),
    opts:opts(['2주 이내','1개월 이내','2개월 이상','미정'],'q.dueO')});
  qs.push({k:'place',label:t('q.placeL'),q:t('q.placeQ'),ph:t('q.placePh'),opts:[]});
  qs.push({k:'mtc',label:t('q.mtcL'),q:t('q.mtcQ'),ph:'',
    opts:opts(['필요합니다','불필요','모르겠습니다'],'q.mtcO')});
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
