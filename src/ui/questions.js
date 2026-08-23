/** 결손 → 질문 생성 · 답변 반영
 *
 *  목표는 **공급처가 이 답변만 보고 단가를 낼 수 있는 것**입니다.
 *  재질·형상·치수·수량만으로는 견적이 안 나옵니다. 표면 마감, 열처리 상태,
 *  절단 여부, 공차, 성적서 등급, 원산지 제한, 인도 조건, 발주 형태가 모두
 *  단가를 움직입니다. 대신 하나하나 다 적게 하지 않고 대부분 칩 한 번으로
 *  끝나게 하고, 모르면 넘어갈 수 있는 선택지를 항상 둡니다.
 *
 *  선택지는 `{v, t}` 입니다.
 *   v — 한국어 식별자. `applyAnswer` 의 비교와 요청서·DB 에 그대로 들어갑니다
 *   t — 화면에 보이는 문구. 언어에 따라 바뀝니다
 *  v 를 번역하면 아래 비교문이 전부 어긋나고 담당자가 받는 요청서도 언어별로 갈라집니다.
 *
 *  질문은 `askQ()` 가 그릴 때 평가됩니다. `q`·`ph`·`label`·`opts` 에 함수를 넣으면
 *  앞선 답변에 따라 달라지고, `when()` 이 거짓이면 그 질문은 건너뜁니다.
 */
import { S } from '../state.js';
import { diagnose } from '../engine/parse.js';
import { catOf } from '../engine/suppliers.js';
import { renderSpec } from './spec-table.js';
import { t } from '../i18n/index.js';

/** 한국어 식별자 배열 + 사전 키 → [{v,t}] */
function opts(values, key) {
  var labels = t(key);
  return values.map(function (v, i) {
    return { v: v, t: (Array.isArray(labels) && labels[i]) || v };
  });
}
/* ══════════ 소재군 — 표면·열처리 선택지가 여기에 따라 갈립니다 ══════════ */

var MAT_VALUES = ['스테인리스', '알루미늄', '특수강·공구강', '인코넬·티타늄', '구조용강', '구리·동합금'];

/** 고르신 소재의 **화면 문구**. 질문에 끼워 넣을 때 한국어 식별자가 그대로
 *  영어 문장에 섞이지 않도록 사전의 라벨을 찾아 씁니다. */
function matLabel() {
  var i = MAT_VALUES.indexOf(S.ANS.needMat);
  var labels = t('q.needMatO');
  return (i >= 0 && Array.isArray(labels) && labels[i]) || S.ANS.needMat || '';
}

var GRADES = {
  '스테인리스':    ['STS304', 'STS316L', 'STS310S', 'STS430', '모르겠습니다'],
  '알루미늄':      ['A1050', 'A5052', 'A6061-T6', 'A7075-T6', '모르겠습니다'],
  '특수강·공구강': ['S45C', 'SCM440', 'SKD11', 'SKD61', '모르겠습니다'],
  '인코넬·티타늄': ['인코넬600', '인코넬625', 'Ti Gr.2', 'Ti Gr.5', '모르겠습니다'],
  '구조용강':      ['SS400', 'S355', 'SM490', 'SPHC', '모르겠습니다'],
  '구리·동합금':   ['C1100', 'C2600 황동', 'C5191 인청동', '모르겠습니다'],
};

/** 품목들의 소재군. 섞여 있으면 'mixed'. */
function matGroup() {
  var set = {};
  S.ITEMS.forEach(function (it) { set[catOf((it.grades || []).join(' '))] = 1; });
  var keys = Object.keys(set);
  if (keys.length !== 1) return 'mixed';        // 비었거나 섞였으면 공통 선택지
  var c = keys[0];
  if (c === '스테인리스') return 'stainless';
  if (c === '알루미늄') return 'alu';
  if (c === '티타늄·니켈') return 'exotic';
  return 'steel';
}

var FINISH = {
  stainless: ['2B', 'No.4 헤어라인', 'BA 경면', '산세(No.1)', '도면·사양대로', '모르겠습니다'],
  alu:       ['밀 피니시', '아노다이징', '보호필름 부착', '도면·사양대로', '모르겠습니다'],
  steel:     ['흑피(열연 그대로)', '산세', '연마', '도금·도장', '도면·사양대로', '모르겠습니다'],
  exotic:    ['연마', '산세', '도면·사양대로', '모르겠습니다'],
  mixed:     ['도면·사양대로', '품목마다 다름', '모르겠습니다'],
};
var HEAT = {
  alu:    ['T6', 'T651', 'O (소둔)', '지정 없음', '모르겠습니다'],
  steel:  ['생재', '조질(QT)', '소둔', '담금질 완료', '지정 없음', '모르겠습니다'],
  mixed:  ['지정 없음', '품목마다 다름', '모르겠습니다'],
};

/* ══════════ 형상별 치수 ══════════ */

var DIM_A = {           // 1차 치수 — 형상마다 묻는 것이 다릅니다
  '판재':      'thick', '코일': 'thick',
  '환봉':      'dia',
  '각관·강관': 'tube',  '파이프': 'tube',
  '앵글':      'spec',  '채널': 'spec', 'H형강': 'spec',
};
function shapeKey() {
  var sh = S.ANS.needShape || '';
  return DIM_A[sh] || 'free';
}

/* ══════════ 질문 ══════════ */

/** 자료에서 품목을 하나도 못 찾았을 때 — 무엇이 얼마나 필요한지 대화로 채웁니다.
 *  "알루미늄이 필요합니다" 처럼 소재만 말씀하신 경우가 여기에 해당합니다. */
function needQuestions() {
  return [
    { k: 'needMat', label: t('q.needMatL'), q: t('q.needMatQ'), ph: t('q.needMatPh'),
      opts: opts(MAT_VALUES, 'q.needMatO') },

    // 세부 강종 — 앞에서 고른 소재군에 맞는 것만 보여줍니다
    { k: 'needGrade', label: t('q.needGradeL'),
      q: function () { return t('q.needGradeQ', { mat: matLabel() }); },
      ph: t('q.needGradePh'),
      opts: function () {
        var list = GRADES[S.ANS.needMat] || GRADES['구조용강'];
        return opts(list, 'q.needGradeO.' + (S.ANS.needMat || '구조용강'));
      } },

    { k: 'needShape', label: t('q.needShapeL'), q: t('q.needShapeQ'), ph: t('q.needShapePh'),
      opts: opts(['판재', '환봉', '각관·강관', '파이프', '앵글', '코일', '기타'], 'q.needShapeO') },

    // 치수는 형상에 따라 묻는 항목이 다릅니다 (판재는 두께, 환봉은 지름 …)
    { k: 'needDimA', label: function () { return t('q.dimA.' + shapeKey() + 'L'); },
      q:  function () { return t('q.dimA.' + shapeKey() + 'Q'); },
      ph: function () { return t('q.dimA.' + shapeKey() + 'Ph'); }, opts: [] },
    { k: 'needDimB', label: function () { return t('q.dimB.' + shapeKey() + 'L'); },
      q:  function () { return t('q.dimB.' + shapeKey() + 'Q'); },
      ph: function () { return t('q.dimB.' + shapeKey() + 'Ph'); }, opts: [],
      when: function () { return shapeKey() !== 'free'; } },

    { k: 'needQty',  label: t('q.needQtyL'),  q: t('q.needQtyQ'),  ph: t('q.needQtyPh'), opts: [] },
    { k: 'needUnit', label: t('q.needUnitL'), q: t('q.needUnitQ'), ph: '',
      opts: opts(['장', '본', '개(EA)', 'kg', '톤', 'm'], 'q.needUnitO') },
  ];
}

/** 어느 품목에든 단가를 좌우하는 조건들. 공급처가 되묻지 않게 미리 받습니다. */
function quoteQuestions() {
  return [
    { k: 'usage', label: t('q.usageL'), q: t('q.usageQ'), ph: t('q.usagePh'),
      opts: opts(['구조물·프레임', '기계부품·가공', '금형', '배관·플랜트', '판금·외장', '기타'],
                 'q.usageO') },

    { k: 'finish', label: t('q.finishL'), q: t('q.finishQ'), ph: t('q.finishPh'),
      opts: function () { var g = matGroup(); return opts(FINISH[g], 'q.finishO.' + g); } },

    { k: 'heat', label: t('q.heatL'), q: t('q.heatQ'), ph: t('q.heatPh'),
      // 스테인리스·인코넬은 고용화 열처리가 기본이라 조질을 따로 묻지 않습니다
      when: function () { var g = matGroup(); return g === 'alu' || g === 'steel' || g === 'mixed'; },
      opts: function () { var g = matGroup(); return opts(HEAT[g] || HEAT.mixed, 'q.heatO.' + (HEAT[g] ? g : 'mixed')); } },

    { k: 'fab', label: t('q.fabL'), q: t('q.fabQ'), ph: t('q.fabPh'),
      opts: opts(['정척 그대로', '치수대로 재단', '기계가공까지', '상담 필요'], 'q.fabO') },

    { k: 'tol', label: t('q.tolL'), q: t('q.tolQ'), ph: t('q.tolPh'),
      opts: opts(['일반 공차 (KS·JIS 표준)', '정밀 공차 지정', '도면대로', '모르겠습니다'], 'q.tolO') },

    { k: 'mtc', label: t('q.mtcL'), q: t('q.mtcQ'), ph: '',
      opts: opts(['불필요', '밀시트 (EN 10204 3.1)', '3.2 입회검사', '모르겠습니다'], 'q.mtcO') },

    { k: 'origin', label: t('q.originL'), q: t('q.originQ'), ph: t('q.originPh'),
      opts: opts(['무관', '국산 우선', '수입 가능', '특정국 제외'], 'q.originO') },

    { k: 'due', label: t('q.dueL'), q: t('q.dueQ'), ph: t('q.duePh'),
      opts: opts(['2주 이내', '1개월 이내', '2개월 이상', '미정'], 'q.dueO') },

    { k: 'place', label: t('q.placeL'), q: t('q.placeQ'), ph: t('q.placePh'), opts: [] },

    { k: 'incoterm', label: t('q.incotermL'), q: t('q.incotermQ'), ph: t('q.incotermPh'),
      opts: opts(['국내 지정지 인도', '공장 출고 (EXW)', 'FOB', 'CIF', 'DDP', '협의'], 'q.incotermO') },

    { k: 'repeat', label: t('q.repeatL'), q: t('q.repeatQ'), ph: t('q.repeatPh'),
      opts: opts(['이번 1회', '월 정기', '연간 계약 예정', '미정'], 'q.repeatO') },
  ];
}

export function buildQuestions() {
  var qs = [];
  if (!S.ANS.contact)
    qs.push({ k: 'contact', label: t('q.contactL'), q: t('q.contactQ'), ph: t('q.contactPh'), opts: [] });
  if (!S.ITEMS.length) qs = qs.concat(needQuestions());

  // 자료에서 읽은 품목의 결손 — 판독으로 메울 수 없는 것만
  if (S.GAPS.ambig.length)
    qs.push({ k: 'dimdef', label: t('q.dimdefL'), q: t('q.dimdefQ', { n: S.GAPS.ambig.length }), ph: '',
      opts: opts(['길이(Length)', '두께(Thickness)', '외경/내경 순서', '모르겠습니다'], 'q.dimdefO'),
      rows: S.GAPS.ambig });
  if (S.GAPS.noLen.length)
    qs.push({ k: 'length', label: t('q.lengthL'), q: t('q.lengthQ', { n: S.GAPS.noLen.length }),
      ph: t('q.lengthPh'),
      opts: opts(['정척 6m 기준', '재단 길이 별도 지정', '길이 확인 후 회신'], 'q.lengthO'),
      rows: S.GAPS.noLen });
  if (S.GAPS.noGrade.length)
    qs.push({ k: 'grade', label: t('q.gradeL'), q: t('q.gradeQ', { n: S.GAPS.noGrade.length }),
      ph: t('q.gradePh'),
      opts: opts(['S355', 'SS400', 'SM490', '모르겠습니다'], 'q.gradeO'),
      rows: S.GAPS.noGrade });
  if (S.GAPS.multiGrade.length)
    qs.push({ k: 'grade2', label: t('q.grade2L'), q: t('q.grade2Q', { n: S.GAPS.multiGrade.length }), ph: '',
      opts: opts(['앞의 강종', '뒤의 강종', '둘 다 견적'], 'q.grade2O'),
      rows: S.GAPS.multiGrade });
  if (S.GAPS.aero.length)
    qs.push({ k: 'aero', label: t('q.aeroL'), q: t('q.aeroQ', { n: S.GAPS.aero.length }), ph: '',
      opts: opts(['일반 산업용 (인증 불요)', 'AMS·EN 인증 필요', '확인 후 회신'], 'q.aeroO'),
      rows: S.GAPS.aero });
  if (S.GAPS.dup.length)
    qs.push({ k: 'dup', label: t('q.dupL'), q: t('q.dupQ', { n: S.GAPS.dup.length }), ph: '',
      opts: opts(['별건입니다', '중복 기재 — 하나만', '수량을 합쳐주십시오'], 'q.dupO'),
      rows: S.GAPS.dup });

  return qs.concat(quoteQuestions());
}

/* ══════════ 답변 반영 ══════════ */

/** 대화로 만든 품목 한 줄. 자료에서 읽은 품목이 없을 때만 씁니다. */
function chatItem() {
  var it = S.ITEMS.find(function (x) { return x.fromChat; });
  if (!it) {
    it = { fromChat: true, raw: '', grades: [], shape: '(미분류)', dim: '(미기재)',
           dims: [], qty: '', unit: '', needLen: false, hasLen: true, ambiguous: false,
           no: S.ITEMS.length + 1, issues: [], state: '조건부' };
    S.ITEMS.push(it);
  }
  return it;
}

var NEED_KEYS = { needMat: 1, needGrade: 1, needShape: 1, needDimA: 1, needDimB: 1,
                  needQty: 1, needUnit: 1 };

/** 두 치수 답변을 형상에 맞는 한 줄로 합칩니다 (공급처가 그대로 읽는 칸입니다). */
function joinDim() {
  var a = (S.ANS.needDimA || '').trim(), b = (S.ANS.needDimB || '').trim();
  if (!a && !b) return '(미기재)';
  switch (shapeKey()) {
    case 'thick': return b ? 't' + a + ' × ' + b : 't' + a;
    case 'dia':   return b ? 'Ø' + a + ' × L' + b : 'Ø' + a;
    case 'tube':  return b ? a + ' × L' + b : a;
    case 'spec':  return b ? a + ' × L' + b : a;
    default:      return [a, b].filter(Boolean).join(' × ');
  }
}

function applyNeed(k, v) {
  var it = chatItem();
  if (k === 'needMat')   it.grades = [v];
  // 세부 강종을 아시면 그쪽이 견적에 쓰입니다. 모르시면 소재군을 그대로 둡니다
  if (k === 'needGrade') it.grades = (v === '모르겠습니다') ? [S.ANS.needMat] : [v];
  if (k === 'needShape') it.shape = (v === '기타') ? '(미분류)' : v;
  if (k === 'needDimA' || k === 'needDimB') it.dim = joinDim();
  if (k === 'needQty')   it.qty = v;
  if (k === 'needUnit')  it.unit = v;

  it.raw = [it.grades[0], it.shape !== '(미분류)' ? it.shape : '',
            it.dim !== '(미기재)' ? it.dim : '',
            [it.qty, it.unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  it.note = '고객 확인';
  S.GAPS = diagnose(S.ITEMS);
  renderSpec();
}

export function applyAnswer(k, v, rows) {
  S.ANS[k] = v;
  if (NEED_KEYS[k]) return applyNeed(k, v);
  if (!rows) return;
  rows.forEach(function (n) {
    var it = S.ITEMS[n - 1]; if (!it) return;
    if (k === 'dimdef') {
      it.issues = it.issues.filter(function (s) { return s !== '치수 열 정의 불명'; });
      it.lenNote = '첫 값 = ' + v;
    }
    if (k === 'length') {
      it.issues = it.issues.filter(function (s) { return s !== '길이 미기재'; });
      it.lenNote = v;
    }
    if (k === 'grade' && v !== '모르겠습니다') {
      it.issues = it.issues.filter(function (s) { return s !== '강종 미기재'; });
      it.grades = [v]; it.note = '고객 확인';
    }
    if (k === 'grade2') {
      it.issues = it.issues.filter(function (s) { return s !== '강종 2개 병기'; });
      if (v === '앞의 강종') it.grades = [it.grades[0]];
      else if (v === '뒤의 강종') it.grades = [it.grades[it.grades.length - 1]];
      it.note = '고객 확인';
    }
    if (k === 'dup' && v !== '별건입니다') {
      it.issues = it.issues.filter(function (s) { return s.indexOf('중복') < 0; });
      it.note = v;
    }
    it.state = it.issues.length === 0 ? '확정' : (it.issues.some(function (s) {
      return s === '길이 미기재' || s === '강종 미기재'; }) ? '불가' : '조건부');
  });
  renderSpec();
}
