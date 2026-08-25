/** 자료 텍스트 → 품목 판독 · 결손 진단 */
var GRADE_RE = /(S\s?690\s?QL|S\s?355(?:\s?J[R0-9]{1,2})?|SAE\s*\d{4}\s*[-–]\s*\d{4}|SAE\s*\d{4}|ASTM\s*A\s*\d+(?:\.\d+)?|AA\s*\d{4}\s*[-–]?\s*T\d+|A\s?\d{4}\s*[-–]\s*T\d+|\d{4}\s*[-–]\s*T\d{2,3}|STS\s?\d{3}\s?L?|SUS\s?\d{3}\s?L?|SPHC|SPCC|SCM\s?\d{3}|SNCM\s?\d{3}|SKD\s?\d+|SKH\s?\d+|S\s?45\s?C|SM\s?\d{3}[A-Z]?|SS\s?\d{3}|STK\s?\d{3}|HE\s?\d{3}\s?[AB]|Ti\s?Gr\.?\s?\d|인코넬\s?\d{3}|하스텔로이\s?\S*|모넬\s?\d{3})/gi;

var SHAPES = [
  {re:/\bTUBE\b|각\s?관|각파이프/i, name:'각관·강관', needLen:true},
  {re:/\bANGLE\b|CORNIERE|앵글|ㄱ형강/i, name:'앵글', needLen:true},
  {re:/\bSECTION\s*U\b|CHANNEL|채널|ㄷ형강/i, name:'채널', needLen:true},
  {re:/\bBEAM\b|\bHE\s?\d{3}|H\s?형강|H-?BEAM/i, name:'H형강', needLen:true},
  {re:/\bPIPE\b|파이프/i, name:'파이프', needLen:true},
  {re:/FORG(E|ED|ING)|자유단조|형단조|단조/i, name:'단조', needLen:false},
  {re:/CAST(ING|INGS)?\b|주물|주강|주조품/i, name:'주물', needLen:false},
  {re:/\bRING\b|\b링\b/i, name:'링', needLen:false},
  {re:/\bRB\b|ROUND\s*BAR|\bBAR\b|환봉/i, name:'환봉', needLen:true},
  {re:/\bPLATE\b|판재|후판/i, name:'판재', needLen:false},
  {re:/\bSHEET\b|박판/i, name:'판재', needLen:false},
  {re:/\bCOIL\b|코일/i, name:'코일', needLen:false},
  {re:/O-?RING|오링|SEAL/i, name:'씰링부품', needLen:false}
];
var AERO_RE = /(2024|7075|2017|7050|Ti\s?Gr\.?\s?5)/i;

function cleanNum(x){ return parseFloat(String(x).replace(/[^0-9.]/g,'')); }

export function parseLine(raw){
  var line = String(raw).replace(/\s+/g,' ').trim();
  if(!line || line.length<3) return null;
  if(/^(IDENTIFICATION|DESCRIPTION|재질|Item|No\.?|Q'?TY|SUPPLIER|Material|Spec)/i.test(line) && !/\d{2}/.test(line)) return null;

  var grades = line.match(GRADE_RE) || [];
  grades = grades.map(function(g){ return g.replace(/\s+/g,' ').trim(); })
                 .map(function(g){ return g.replace(/\s+[\d.]+\s*[x×*].*$/i,'').trim(); })
                 .filter(function(g){ return g.length>1; });
  var uniq = []; grades.forEach(function(g){ if(uniq.indexOf(g)<0) uniq.push(g); });

  var shape=null, needLen=false;
  for(var i=0;i<SHAPES.length;i++){
    if(SHAPES[i].re.test(line)){ shape=SHAPES[i].name; needLen=SHAPES[i].needLen; break; }
  }
  // 치수 패턴
  var dim='', dims=[];
  // 지름 목록 — "Ø(13,16,…,46) 각 50본" 처럼 여러 지름을 한 줄로 받는 실무 표기
  var m0 = line.match(/(Ø|φ|∅)\s*\(?\s*([\d.]+(?:\s*[,，·]\s*[\d.]+)+)\s*\)?/i);
  var m1 = line.match(/(Ø|φ|∅)\s*([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  var m2 = line.match(/([\d.]+)\s*[t]?\s*[x×*]\s*([\d.]+)\s*[x×*]\s*([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  var m3 = line.match(/([\d.]+)\s*[t]?\s*[x×*]\s*([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  var m4 = line.match(/([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  if(m0){
    dims = m0[2].split(/[,，·]/).map(function(x){ return x.trim(); }).filter(Boolean);
    dim = 'Ø' + dims[0] + '~' + dims[dims.length-1] + ' (' + dims.length + '종)';
  }
  else if(m2){ dims=[m2[1],m2[2],m2[3],m2[4]]; dim=dims.join(' × '); }
  else if(m3){ dims=[m3[1],m3[2],m3[3]]; dim=dims.join(' × '); }
  else if(m1){ dims=[m1[2],m1[3]]; dim='Ø'+m1[2]+' × t'+m1[3]; }
  else if(m4){ dims=[m4[1],m4[2]]; dim=dims.join(' × '); }

  var qty=null, ambiguous=false;
  var nums = line.match(/(?:^|\s)([\d.]+)(?=\s|$)/g);
  if(nums) nums = nums.map(function(n){ return n.trim(); });
  if(!dim && nums && nums.length>=3){
    // 라벨 없는 숫자 나열 (표 형식) — 마지막을 수량으로 보고 나머지를 치수로 추정
    var body = nums.slice(0, nums.length-1);
    qty = Math.round(cleanNum(nums[nums.length-1]));
    dims = body; dim = body.join(' / ');
    ambiguous = true;
  } else if(nums && nums.length){
    var lastTok = nums[nums.length-1];
    var v = cleanNum(lastTok);
    if(v>0 && v<10000 && Number.isInteger(v) && dims.indexOf(lastTok)<0) qty=v;
  }
  // 단위가 붙은 수량 — "각 50본" "20장" "100개". 치수 숫자와 헷갈리지 않는 가장 확실한 표기라
  // 트레일링 숫자 추정보다 우선합니다. "각"이 있으면 지름·규격당 수량입니다.
  // \b 는 한글 뒤에서 성립하지 않으므로 ASCII 단위에만 붙입니다
  var mq = line.match(/(?:각각?\s*)?([\d,]+)\s*(?:본|장|개|매|롤|EA\b|PCS\b)/i);
  if(mq){ var qv = cleanNum(mq[1]); if(qv>0 && qv<100000) { qty = Math.round(qv); ambiguous = false; } }
  if(!shape && dims.length===3 && /t|\*/.test(line)) { shape='판재'; needLen=false; }
  if(!uniq.length && !shape && !dim) return null;

  var hasLen = /\bL\s*[:=]?\s*[\d.]+|\b\d{4,6}\s*L\b|길이|\b\d+\s?m\b|정척/i.test(line);
  return {
    raw: line, grades: uniq, shape: shape||'(미분류)', dim: dim||'(미기재)',
    dims: dims, qty: qty, needLen: needLen, hasLen: hasLen, ambiguous: ambiguous
  };
}

export function diagnose(items){
  var seen={}, gaps={noGrade:[],multiGrade:[],noLen:[],ambig:[],noQty:[],dup:[],aero:[]};
  items.forEach(function(it,idx){
    it.no=idx+1; it.issues=[];
    if(!it.grades.length){ it.issues.push('강종 미기재'); gaps.noGrade.push(it.no); }
    if(it.grades.length>1){ it.issues.push('강종 2개 병기'); gaps.multiGrade.push(it.no); }
    if(it.needLen && !it.hasLen && !it.ambiguous){ it.issues.push('길이 미기재'); gaps.noLen.push(it.no); }
    if(it.ambiguous){ it.issues.push('치수 열 정의 불명'); gaps.ambig.push(it.no); }
    if(!it.qty){ it.issues.push('수량 미기재'); gaps.noQty.push(it.no); }
    if(it.grades.some(function(g){ return AERO_RE.test(g); })){ gaps.aero.push(it.no); }
    var key=(it.grades.join('')+it.dim).replace(/\s/g,'');
    if(seen[key]){ it.issues.push('중복 의심(' + seen[key] + '번)'); gaps.dup.push(it.no); }
    else seen[key]=it.no;
    it.state = it.issues.length===0 ? '확정' : (it.issues.some(function(s){
      return s==='길이 미기재'||s==='강종 미기재'; }) ? '불가' : '조건부');
  });
  return gaps;
}
