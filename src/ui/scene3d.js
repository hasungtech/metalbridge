/** 거래 흐름 지구본 — 정사영(orthographic) · 실제 지리 데이터
 *  Natural Earth countries-110m (world-atlas, ISC) 를 topojson.mesh() 로 해안선·국경으로 만들고,
 *  각 점을 단위 벡터로 미리 변환해 두었다가 프레임마다 회전 행렬만 적용합니다.
 *  DOM: #globeCanvas, #globeLabels, #zones
 */
import { reduce } from '../state.js';
import { feature, mesh } from 'topojson-client';
import { SUPPLIER_MASTER } from '../engine/suppliers.js';

/* 나라 단위입니다. 도시 이름은 쓰지 않습니다 — 발송은 국가 단위로 나갑니다.
   lat/lon 은 지구본에 점을 찍을 좌표일 뿐이고 화면에 도시명으로 드러나지 않습니다.
   배치는 matchSuppliers() 의 1차/2차 기준입니다. */
export const ZONES = [
  { key:'kr', en:'KOREA', ko:'한국', lat:35.18, lon:129.08,
    good:'국내 유통 재고 · 소량 대응',   batch:'1차', meta:'최단 납기 · 검수 직접 수행', dir:'up-left' },
  { key:'cn', en:'CHINA', ko:'중국', lat:31.23, lon:121.47,
    good:'대량 압연재 · 단가 비교',      batch:'1차', meta:'대형 밀 · 성적서 검증 필요', dir:'down-left' },
  { key:'jp', en:'JAPAN', ko:'일본', lat:34.69, lon:135.50,
    good:'특수강 · 규격 재확인',         batch:'1차', meta:'품질 안정 · 소량 대응', dir:'right' },
  { key:'in', en:'INDIA', ko:'인도', lat:19.08, lon:72.88,
    good:'피팅 · 플랜지 가공품',         batch:'2차', meta:'대량 물량 · 대체 강종 제안', dir:'right' },
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
  const meta = document.getElementById('globeMeta');
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim() || '#999';
  const C = { line:tok('--stone'), grid:tok('--hairline-soft'), rim:tok('--hairline'),
              hot:tok('--molten'), dim:tok('--hairline'), node:tok('--charcoal'), flow:tok('--blue-lo') };

  let land = [];
  const grid = graticule();
  const paths = ZONES.slice(1).map((z, i) => ({ key:z.key, phase:i/3, pts:greatCircle(HUB, z, 64) }));
  let rot = 108, dir = 1, drag = null, hover = null, vis = true;

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
      const cx = w/2, cy = h/2, R = Math.min(w, h)/2 - 12;

      if(!reduce && !drag && hover === null){
        rot += 0.04 * dir;
        if(rot > 132) dir = -1;
        if(rot < 86)  dir = 1;
      }
      // rot 이 화면 중심 경도가 되도록 90° 보정 (명세: 86~132° 왕복이면 네 도시가 항상 보임)
      const a = -(rot + 90) * D2R, cos = Math.cos(a), sin = Math.sin(a);
      if(meta) meta.textContent = 'ORTHOGRAPHIC · LON ' + Math.round(((rot % 360) + 360) % 360);

      ctx.strokeStyle = C.rim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
      for(const g of grid) strokePolyline(ctx, g, cx, cy, R, cos, sin, C.grid, 1);
      for(const l of land) strokePolyline(ctx, l, cx, cy, R, cos, sin, C.line, 1);

      const t = Math.max(0, now - t0) / 1000;
      paths.forEach(function(pp){
        const on = hover === null || hover === pp.key;
        strokePolyline(ctx, pp.pts, cx, cy, R, cos, sin, on ? C.hot : C.dim, on ? 1.4 : 1);
        const u = (t * 0.18 + pp.phase) % 1;
        const idx = Math.min(pp.pts.length - 1, Math.max(0, Math.round(u * (pp.pts.length - 1))));
        const p = project(pp.pts[idx], cx, cy, R, cos, sin);
        if(p[2] >= 0){
          ctx.fillStyle = on ? C.hot : C.flow;
          ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI*2); ctx.fill();
        }
      });

      ZONES.forEach(function(z, i){
        const p = project(unit(z.lat, z.lon), cx, cy, R, cos, sin);
        const front = p[2] >= 0;
        if(front){
          ctx.fillStyle = (hover === null || hover === z.key) ? C.hot : C.node;
          ctx.beginPath(); ctx.arc(p[0], p[1], i === 0 ? 4.5 : 3.5, 0, Math.PI*2); ctx.fill();
        }
        const el = labelBox && labelBox.children[i];
        if(el){
          el.style.display = front ? 'block' : 'none';
          el.style.left = p[0] + 'px';
          el.style.top  = p[1] + 'px';
        }
      });
    }
    requestAnimationFrame(frame);
  }

  /* 라벨 오버레이 — 노드마다 방향이 달라야 한국·일본이 겹치지 않습니다 */
  if(labelBox){
    labelBox.innerHTML = ZONES.map(z =>
      '<span class="glabel dir-'+z.dir+'"><b>'+z.en+'</b><i>후보 '+supplierCount(z.ko)+'</i></span>').join('');
  }

  /* 권역 목록 + 호버 연동 */
  const zoneBox = document.getElementById('zones');
  if(zoneBox){
    zoneBox.innerHTML = ZONES.map(z =>
      '<div class="zone" data-k="'+z.key+'">'+
        '<div class="zone-top"><i class="'+(z.batch==='1차'?'on':'')+'"></i>'+
          '<span class="zone-en">'+z.en+'</span>'+
          '<span class="zone-batch mono">'+(z.batch==='1차'?'1차 발송':'2차 대기')+'</span></div>'+
        '<div class="zone-name"><b class="zone-ko">'+z.ko+'</b>'+
          '<span class="zone-n mono">후보 공급처 <b>'+supplierCount(z.ko)+'</b>곳</span></div>'+
        '<p class="zone-good">'+z.good+'</p>'+
        '<p class="zone-meta mono">'+z.meta+'</p>'+
      '</div>').join('');
    Array.prototype.forEach.call(zoneBox.children, function(row){
      row.addEventListener('mouseenter', function(){ hover = row.dataset.k; });
      row.addEventListener('mouseleave', function(){ hover = null; });
    });
  }

  cv.addEventListener('pointerdown', function(e){
    drag = { x:e.clientX, r:rot }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function(e){
    if(drag) rot = drag.r + (e.clientX - drag.x) * 0.4;
  });
  ['pointerup','pointercancel'].forEach(function(ev){
    cv.addEventListener(ev, function(){
      if(!drag) return;
      drag = null;
      rot = Math.max(86, Math.min(132, ((rot % 360) + 360) % 360));  // 왕복 범위로 복귀
    });
  });

  new IntersectionObserver(function(es){ es.forEach(function(e){ vis = e.isIntersecting; }); },
    { threshold:0 }).observe(cv);

  /* 화면 밖이면 루프가 쉬므로 라벨 좌표가 낡습니다. 크기가 바뀌면 한 프레임만 다시 그립니다. */
  window.addEventListener('resize', function(){
    const was = vis; vis = true; frame(performance.now()); vis = was;
  });

  requestAnimationFrame(frame);
}
