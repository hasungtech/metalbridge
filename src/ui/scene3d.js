/** 거래 흐름 지구본 — 정사영(orthographic) · 실제 지리 데이터
 *  Natural Earth countries-110m (world-atlas, ISC) 를 topojson.mesh() 로 해안선·국경으로 만들고,
 *  각 점을 단위 벡터로 미리 변환해 두었다가 프레임마다 회전 행렬만 적용합니다.
 *  DOM: #globeCanvas, #globeLabels, #zones
 */
import { reduce } from '../state.js';
import { feature, mesh } from 'topojson-client';
import { SUPPLIER_MASTER, MARKET_POOL } from '../engine/suppliers.js';
import { t, onLangChange } from '../i18n/index.js';

/* 나라 단위입니다. 도시 이름은 쓰지 않습니다 — 발송은 국가 단위로 나갑니다.
   lat/lon 은 지구본에 점을 찍을 좌표일 뿐이고 화면에 도시명으로 드러나지 않습니다.
   배치는 matchSuppliers() 의 1차/2차 기준입니다. */
/* ko 는 공급처 마스터를 세는 키입니다 — 마스터의 국가명이 한국어라 번역하지 않습니다.
   화면 문구는 i18n 사전 zone.* 에서 가져옵니다. */
export const ZONES = [
  { key:'kr', en:'KOREA', ko:'한국', lat:35.18, lon:129.08, batch:'1차', dir:'up-left' },
  { key:'cn', en:'CHINA', ko:'중국', lat:31.23, lon:121.47, batch:'1차', dir:'down-left' },
  { key:'jp', en:'JAPAN', ko:'일본', lat:34.69, lon:135.50, batch:'1차', dir:'right' },
  { key:'in', en:'INDIA', ko:'인도', lat:19.08, lon:72.88,  batch:'2차', dir:'down-left', ny:18 },
];
const HUB = ZONES[0];

/* 나라별 후보 공급처 수 — 마스터에서 세어 씁니다.
   숫자를 이 파일에 적어두면 SUPPLIER_MASTER 를 갈아끼울 때 어긋납니다.
   거래처가 아니라 후보입니다 (CLAUDE.md 문구 규칙). */
export function supplierCount(ko){
  return SUPPLIER_MASTER.filter(function(sp){ return sp.c === ko; }).length;
}

const D2R = Math.PI / 180;
const unit = (lat, lon) => {
  const p = (90 - lat) * D2R, t = (lon + 180) * D2R;
  return [-(Math.sin(p) * Math.cos(t)), Math.cos(p), Math.sin(p) * Math.sin(t)];
};

/** 두 지점 사이 대권 경로 */
function greatCircle(a, b, n){
  const A = unit(a.lat, a.lon), B = unit(b.lat, b.lon);
  const dot = Math.max(-1, Math.min(1, A[0]*B[0] + A[1]*B[1] + A[2]*B[2]));
  const om = Math.acos(dot), s = Math.sin(om);
  const out = [];
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const k1 = s < 1e-6 ? 1 - t : Math.sin((1 - t) * om) / s;
    const k2 = s < 1e-6 ? t     : Math.sin(t * om) / s;
    const v = [A[0]*k1 + B[0]*k2, A[1]*k1 + B[1]*k2, A[2]*k1 + B[2]*k2];
    const m = Math.hypot(v[0], v[1], v[2]);
    out.push([v[0]/m * 1.012, v[1]/m * 1.012, v[2]/m * 1.012]);
  }
  return out;
}

/** 경선 30° · 위선 30° */
function graticule(){
  const lines = [];
  for(let lon = -180; lon < 180; lon += 30){
    const l = []; for(let lat = -80; lat <= 80; lat += 4) l.push(unit(lat, lon));
    lines.push(l);
  }
  for(let lat = -60; lat <= 60; lat += 30){
    const l = []; for(let lon = -180; lon <= 180; lon += 4) l.push(unit(lat, lon));
    lines.push(l);
  }
  return lines;
}

export function initScene(){
  const cv = document.getElementById('globeCanvas');
  if(!cv) return;
  const labelBox = document.getElementById('globeLabels');
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim() || '#999';
  const C = { line:tok('--stone'), grid:tok('--hairline-soft'), rim:tok('--hairline'),
              hot:tok('--molten'), node:tok('--charcoal') };

  let land = [];
  const grid = graticule();
  const paths = ZONES.slice(1).map((z, i) => ({ key:z.key, phase:i/3, pts:greatCircle(HUB, z, 64) }));
  let rot = 108, drag = null, vis = true;

  /* 지리 데이터는 같은 출처에서 지연 로드합니다 (외부 네트워크 없음) */
  fetch('/geo/countries-110m.json')
    .then(r => r.json())
    .then(topo => {
      const m = mesh(topo, topo.objects.countries);
      land = m.coordinates.map(line => line.map(p => unit(p[1], p[0])));
      void feature;
    })
    .catch(() => { /* 데이터를 못 받으면 격자와 경로만 그립니다 */ });

  function size(){
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, r.width * dpr);
    cv.height = Math.max(1, r.height * dpr);
    return { w:r.width, h:r.height, dpr };
  }

  /** Y축 회전 후 정사영. z>0 인 앞면만 그립니다. */
  function project(v, cx, cy, R, cos, sin){
    const x = v[0]*cos + v[2]*sin, z = -v[0]*sin + v[2]*cos;
    return [cx + x*R, cy - v[1]*R, z];
  }

  function strokePolyline(ctx, pts, cx, cy, R, cos, sin, color, width){
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    let pen = false;
    for(const v of pts){
      const p = project(v, cx, cy, R, cos, sin);
      if(p[2] < 0){ pen = false; continue; }
      if(pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; }
    }
    ctx.stroke();
  }

  let t0 = performance.now();
  function frame(now){
    if(vis){
      const { w, h, dpr } = size();
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      /* 넓은 화면에서는 오른쪽으로 걸쳐 잘려 나갑니다 (문구는 왼쪽을 씁니다).
         좁은 화면에서는 문구 아래 한 장으로 서므로 가운데에 둡니다. */
      const wide = w > 900;
      const cx = wide ? w * 0.78 : w / 2;
      const cy = h * (wide ? 0.48 : 0.5);
      const R  = wide ? Math.min(w, h) * 0.70 : Math.min(w, h) / 2 - 12;

      /* 멈추지 않고 한 방향으로 돕니다. 라벨과 경로는 뒷면에서 스스로 숨으므로
         네 나라가 잠시 안 보이는 구간이 있어도 그대로 둡니다. */
      if(!reduce && !drag) rot += 0.045;
      // rot 이 화면 중심 경도가 되도록 90° 보정
      const a = -(rot + 90) * D2R, cos = Math.cos(a), sin = Math.sin(a);

      ctx.strokeStyle = C.rim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
      for(const g of grid) strokePolyline(ctx, g, cx, cy, R, cos, sin, C.grid, 1);
      for(const l of land) strokePolyline(ctx, l, cx, cy, R, cos, sin, C.line, 1);

      const t = Math.max(0, now - t0) / 1000;
      paths.forEach(function(pp){
        strokePolyline(ctx, pp.pts, cx, cy, R, cos, sin, C.hot, 1.4);
        const u = (t * 0.18 + pp.phase) % 1;
        const idx = Math.min(pp.pts.length - 1, Math.max(0, Math.round(u * (pp.pts.length - 1))));
        const p = project(pp.pts[idx], cx, cy, R, cos, sin);
        if(p[2] >= 0){
          ctx.fillStyle = C.hot;
          ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI*2); ctx.fill();
        }
      });

      ZONES.forEach(function(z, i){
        const p = project(unit(z.lat, z.lon), cx, cy, R, cos, sin);
        const front = p[2] >= 0;
        if(front){
          ctx.fillStyle = i === 0 ? C.hot : C.node;
          ctx.beginPath(); ctx.arc(p[0], p[1], i === 0 ? 4.5 : 3.5, 0, Math.PI*2); ctx.fill();
        }
        const el = labelBox && labelBox.children[i];
        if(el){
          /* 넓은 화면에서는 왼쪽이 카피 자리입니다. 회전으로 그 위까지 넘어온
             라벨은 잠시 숨깁니다 — 글자 위에 글자가 겹칩니다. */
          const clear = !wide || p[0] > w * 0.46;
          el.style.display = (front && clear) ? 'block' : 'none';
          el.style.left = p[0] + 'px';
          el.style.top  = p[1] + 'px';
        }
      });
    }
    requestAnimationFrame(frame);
  }

  /* 라벨 오버레이 — 노드마다 방향이 달라야 한국·일본이 겹치지 않습니다 */
  function paintLabels(){
    if(!labelBox) return;
    labelBox.innerHTML = ZONES.map(z =>
      '<span class="glabel dir-'+z.dir+'"'+(z.ny ? ' style="margin-top:'+z.ny+'px"' : '')+'>'+
      '<b>'+z.en+'</b></span>').join('');
  }
  if(labelBox){
    /* ny — 지구본이 작아지면 중국과 인도가 같은 높이로 붙습니다. 인도만 내려 어긋냅니다. */
    paintLabels();
  }

  /* 권역 — 여기는 나라별 조달망 규모(MARKET_POOL · 운영자 추정)가 주인공입니다.
     마스터 후보 수(supplierCount)가 아닙니다 — 후보는 이 풀에서 먼저 접촉할 곳일 뿐입니다.
     지구본과 떨어져 있어 호버 연동은 뜻이 없어 뺐습니다. */
  function paintZones(){
    const zoneBox = document.getElementById('zones');
    if(!zoneBox) return;
    zoneBox.innerHTML = ZONES.map(z =>
      '<div class="zone" data-k="'+z.key+'">'+
        '<span class="zone-en">'+z.en+'</span>'+
        '<b class="zone-ko">'+t('zone.'+z.key+'.ko')+'</b>'+
        '<p class="zone-n"><span class="mono">'+MARKET_POOL[z.ko]+'</span>'+t('flow.unit')+'</p>'+
        '<p class="zone-good">'+t('zone.'+z.key+'.good')+'</p>'+
        '<p class="zone-meta mono">'+t('zone.'+z.key+'.meta')+'</p>'+
        '<p class="zone-batch mono"><i class="'+(z.batch==='1차'?'on':'')+'"></i>'+
          t(z.batch==='1차'?'flow.batch1':'flow.batch2')+'</p>'+
      '</div>').join('');
  }
  paintZones();
  onLangChange(function(){ paintZones(); paintLabels(); });

  cv.addEventListener('pointerdown', function(e){
    drag = { x:e.clientX, r:rot }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function(e){
    if(drag) rot = drag.r + (e.clientX - drag.x) * 0.4;
  });
  ['pointerup','pointercancel'].forEach(function(ev){
    cv.addEventListener(ev, function(){ drag = null; });  // 놓은 자리에서 계속 돕니다
  });

  new IntersectionObserver(function(es){ es.forEach(function(e){ vis = e.isIntersecting; }); },
    { threshold:0 }).observe(cv);

  /* 화면 밖이면 루프가 쉬므로 라벨 좌표가 낡습니다. 크기가 바뀌면 한 프레임만 다시 그립니다. */
  window.addEventListener('resize', function(){
    const was = vis; vis = true; frame(performance.now()); vis = was;
  });

  requestAnimationFrame(frame);
}
