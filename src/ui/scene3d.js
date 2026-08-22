/** 히어로 3D — 교체·삭제해도 엔진에 영향 없음 */
import * as THREE from 'three';
import { reduce } from '../state.js';
export function initScene(){
function envTexture(renderer){
  var c=document.createElement('canvas'); c.width=512; c.height=256;
  var g=c.getContext('2d');
  var grd=g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0,'#2b2c30'); grd.addColorStop(.42,'#8f939a');
  grd.addColorStop(.5,'#f2f3f5'); grd.addColorStop(.62,'#5f6268'); grd.addColorStop(1,'#0f1012');
  g.fillStyle=grd; g.fillRect(0,0,512,256);
  g.fillStyle='rgba(255,255,255,.7)';
  g.fillRect(40,60,150,24); g.fillRect(300,42,120,16); g.fillRect(190,150,240,9);
  g.fillStyle='rgba(15,98,254,.55)'; g.fillRect(0,112,58,42);
  var tex=new THREE.Texture(c); tex.needsUpdate=true;
  tex.mapping=THREE.EquirectangularReflectionMapping;
  var pm=new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
  var rt=pm.fromEquirectangular(tex); tex.dispose(); pm.dispose();
  return rt.texture;
}
function brushed(){
  var c=document.createElement('canvas'); c.width=256; c.height=256;
  var g=c.getContext('2d'); g.fillStyle='#8a8a8a'; g.fillRect(0,0,256,256);
  for(var i=0;i<2400;i++){
    var v=110+Math.random()*90;
    g.fillStyle='rgba('+v+','+v+','+v+',.34)';
    g.fillRect(Math.random()*256,Math.random()*256,Math.random()*38+8,1);
  }
  var t=new THREE.Texture(c); t.needsUpdate=true;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,4);
  return t;
}
var steelMat=null;
function material(){
  if(!steelMat) steelMat=new THREE.MeshStandardMaterial({
    color:0x9aa0a6, metalness:.92, roughness:.42, roughnessMap:brushed(), side:THREE.DoubleSide});
  return steelMat;
}
function makeScene(canvas,opts){
  var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, window.innerWidth<700?1.5:2));
  if(renderer.outputEncoding!==undefined) renderer.outputEncoding=THREE.sRGBEncoding;
  var scene=new THREE.Scene();
  scene.environment=envTexture(renderer);
  var cam=new THREE.PerspectiveCamera(opts.fov||38,1,.1,100);
  cam.position.set(0,opts.camY,opts.camZ); cam.lookAt(0,0,0);
  var key=new THREE.DirectionalLight(0xffffff,1.4); key.position.set(4,6,5); scene.add(key);
  var fill=new THREE.DirectionalLight(0xdfe6ef,.65); fill.position.set(-6,2,-3); scene.add(fill);
  if(opts.rim){ var rim=new THREE.PointLight(0x0f62fe,opts.rim,22); rim.position.set(-3.4,-1.4,2.6); scene.add(rim); }
  scene.add(new THREE.AmbientLight(0xffffff,.24));
  function resize(){
    var r=canvas.getBoundingClientRect();
    var w=Math.max(r.width,1), h=Math.max(r.height,1);
    renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize',resize);
  return {renderer:renderer,scene:scene,cam:cam,resize:resize};
}
function tube(outer,inner,h,seg){
  var pts=[new THREE.Vector2(inner,-h/2),new THREE.Vector2(outer,-h/2),
           new THREE.Vector2(outer,h/2),new THREE.Vector2(inner,h/2),new THREE.Vector2(inner,-h/2)];
  var g=new THREE.LatheGeometry(pts,seg||96); g.computeVertexNormals(); return g;
}
function plate(){ return new THREE.BoxGeometry(3.2,.16,2.1); }
function billet(){ return new THREE.BoxGeometry(.95,.95,3.6); }
function pipe(){ var g=tube(.55,.42,3.4,64); g.rotateZ(Math.PI/2); return g; }
function coil(){ return tube(1.62,.78,1.25,128); }
function hBeam(){
  var s=new THREE.Shape(), w=1.15,h=1.7,tf=.2,tw=.16;
  s.moveTo(-w/2,-h/2); s.lineTo(w/2,-h/2); s.lineTo(w/2,-h/2+tf); s.lineTo(tw/2,-h/2+tf);
  s.lineTo(tw/2,h/2-tf); s.lineTo(w/2,h/2-tf); s.lineTo(w/2,h/2); s.lineTo(-w/2,h/2);
  s.lineTo(-w/2,h/2-tf); s.lineTo(-tw/2,h/2-tf); s.lineTo(-tw/2,-h/2+tf); s.lineTo(-w/2,-h/2+tf);
  s.closePath();
  var g=new THREE.ExtrudeGeometry(s,{depth:3.6,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2});
  g.center(); g.rotateY(Math.PI/2.2); return g;
}

/* ── 히어로 ── */
var heroEl=document.getElementById('heroCanvas');
var hero=makeScene(heroEl,{camY:.6,camZ:6.4,rim:6});
var heroGroup=new THREE.Group();
var heroCoil=new THREE.Mesh(coil(),material());
heroCoil.rotation.x=Math.PI/2.6; heroCoil.rotation.z=.18; heroGroup.add(heroCoil);
var ring=new THREE.Mesh(tube(1.72,1.66,1.3,96),
  new THREE.MeshStandardMaterial({color:0x8d9196,metalness:1,roughness:.55,side:THREE.DoubleSide}));
ring.rotation.copy(heroCoil.rotation); heroGroup.add(ring);
var slab=new THREE.Mesh(plate(),material());
slab.position.set(2.55,-1.5,-1.4); slab.rotation.set(.12,-.5,.06); slab.scale.setScalar(.85); heroGroup.add(slab);
var bar=new THREE.Mesh(billet(),material());
bar.position.set(-2.8,-1.35,-.8); bar.rotation.set(0,.42,.1); bar.scale.setScalar(.8); heroGroup.add(bar);
heroGroup.scale.setScalar(.82); heroGroup.position.x=1.75;
hero.scene.add(heroGroup);

/* ── 소재 뷰어 ── */
var mats=[
 {k:'스테인리스',t:'스테인리스',d:'부식에 강한 크롬·니켈계 강재. 식품기계·플랜트·건축 설비에 가장 널리 쓰입니다.',
  g:'STS304 · 316 · 316L · 430',s:'판재 · 환봉 · 각재 · 파이프',q:'성분 실측 + 밀시트 대조',mk:plate,rot:[.22,.5,0],
  n:'정형재만 취급합니다. 가공 완료품·도금 완료재는 성분 판정이 불가해 다루지 않습니다.'},
 {k:'특수강·공구강',t:'특수강 · 공구강',d:'열처리로 강도를 올린 기계구조용 강과 금형용 공구강. 축·기어·프레스 금형에 쓰입니다.',
  g:'SCM440 · SNCM439 · SKD11 · SKD61 · SKH51',s:'환봉 · 각재 · 평강 · 블록',q:'성분 실측 + 경도 측정 + 밀시트',mk:billet,rot:[.1,.5,0],
  n:'공구강은 경도(HRC)와 열처리 상태를 함께 확인합니다.'},
 {k:'알루미늄',t:'알루미늄 합금',d:'가볍고 가공성이 좋아 기계 부품·치공구·판금 구조물에 폭넓게 쓰입니다.',
  g:'A6061 · A5052 · A7075 · A1050',s:'판재 · 환봉 · 압출재',q:'성분 실측 + 열처리 표기(T6 등) 확인',mk:pipe,rot:[0,0,0],
  n:'열처리 상태 표기가 없으면 구조용 매칭에서 제외합니다.'},
 {k:'티타늄',t:'티타늄',d:'내식성이 가장 뛰어난 소재. 화학·해수·의료 설비에 쓰이며 수입 리드타임 확보가 관건입니다.',
  g:'Ti Gr.2 · Ti Gr.5 (Ti-6Al-4V)',s:'판재 · 환봉 · 파이프',q:'성분 실측 + 밀시트 추적 필수',mk:coil,rot:[Math.PI/2.6,0,.15],
  n:'항공 인증재는 추적성 사슬이 끊겨 일반 산업용으로만 취급합니다.'},
 {k:'니켈합금',t:'니켈합금',d:'고온·강산 환경용 초합금. 열처리로·석유화학·발전 설비의 핵심 부품에 쓰입니다.',
  g:'인코넬 600 · 625 · 718 · 하스텔로이 C276',s:'판재 · 환봉 · 파이프',q:'성분 실측 + 열처리 상태 + 밀시트',mk:hBeam,rot:[0,.2,0],
  n:'718은 솔루션·시효 처리 상태에 따라 용도가 달라져 별도 확인합니다.'}
];
var vEl=document.getElementById('viewCanvas');
var view=makeScene(vEl,{camY:.9,camZ:6.0,rim:4});
var vMesh=new THREE.Mesh(mats[0].mk(),material());
vMesh.rotation.set(mats[0].rot[0],mats[0].rot[1],mats[0].rot[2]);
var vGroup=new THREE.Group(); vGroup.add(vMesh); view.scene.add(vGroup);
var mChips=document.getElementById('mChips'), activeM=0, swap=0;
mats.forEach(function(m,i){
  var b=document.createElement('button');
  b.className='chip'+(i===0?' on':''); b.type='button'; b.textContent=m.k;
  if(i===0){ b.style.background='#111'; b.style.color='#fff'; b.style.borderColor='#111'; }
  b.addEventListener('click',function(){ selectM(i); });
  mChips.appendChild(b);
});
function selectM(i){
  if(i===activeM) return;
  activeM=i; swap=1;
  Array.prototype.forEach.call(mChips.children,function(c,ci){
    var on=ci===i;
    c.classList.toggle('on',on);
    c.style.background=on?'#111':'#fff'; c.style.color=on?'#fff':'#111';
    c.style.borderColor=on?'#111':'var(--hairline)';
  });
  var m=mats[i];
  document.getElementById('mTitle').textContent=m.t;
  document.getElementById('mDesc').textContent=m.d;
  document.getElementById('mGrade').textContent=m.g;
  document.getElementById('mShape').textContent=m.s;
  document.getElementById('mQc').textContent=m.q;
  document.getElementById('mNote').textContent=m.n;
  setTimeout(function(){
    vMesh.geometry.dispose(); vMesh.geometry=m.mk();
    vMesh.rotation.set(m.rot[0],m.rot[1],m.rot[2]);
  },180);
}

/* ── 공급망 지구본 ── */
var gEl=document.getElementById('globeCanvas');
var globe=makeScene(gEl,{camY:0,camZ:5.2,fov:34});
var gGroup=new THREE.Group(); globe.scene.add(gGroup);
var R=1.75;
var sphere=new THREE.Mesh(new THREE.SphereGeometry(R,48,36),
  new THREE.MeshStandardMaterial({color:0x0b0b0e,metalness:.15,roughness:.92,envMapIntensity:.18}));
gGroup.add(sphere);
var wire=new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.SphereGeometry(R*1.003,36,24)),
  new THREE.LineBasicMaterial({color:0x555a63,transparent:true,opacity:.62}));
gGroup.add(wire);
function ll(lat,lon,r){
  var phi=(90-lat)*Math.PI/180, th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-(r*Math.sin(phi)*Math.cos(th)), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(th));
}
var HUB={lat:35.1,lon:129.0,n:'부산 · METAL BRIDGE'};
var NODES=[
 {lat:31.2,lon:121.5,n:'상하이',c:'중국'},{lat:39.1,lon:117.2,n:'톈진',c:'중국'},
 {lat:23.1,lon:113.3,n:'광저우',c:'중국'},{lat:35.7,lon:139.7,n:'도쿄',c:'일본'},
 {lat:34.7,lon:135.5,n:'오사카',c:'일본'},{lat:19.1,lon:72.9,n:'뭄바이',c:'인도'},
 {lat:13.1,lon:80.3,n:'첸나이',c:'인도'},{lat:36.0,lon:129.4,n:'포항',c:'한국'},
 {lat:37.5,lon:126.9,n:'서울',c:'한국'}
];
var hubPos=ll(HUB.lat,HUB.lon,R);
var hubDot=new THREE.Mesh(new THREE.SphereGeometry(.075,18,18),
  new THREE.MeshBasicMaterial({color:0x0f62fe}));
hubDot.position.copy(hubPos); gGroup.add(hubDot);
var halo=new THREE.Mesh(new THREE.RingGeometry(.13,.155,32),
  new THREE.MeshBasicMaterial({color:0x0f62fe,transparent:true,opacity:.75,side:THREE.DoubleSide}));
halo.position.copy(hubPos.clone().multiplyScalar(1.01));
halo.lookAt(new THREE.Vector3(0,0,0)); gGroup.add(halo);
var travellers=[];
NODES.forEach(function(nd,i){
  var pos=ll(nd.lat,nd.lon,R);
  var dot=new THREE.Mesh(new THREE.SphereGeometry(.055,14,14),
    new THREE.MeshBasicMaterial({color:0xeef1f4}));
  dot.position.copy(pos); gGroup.add(dot);
  var mid=pos.clone().add(hubPos).multiplyScalar(.5).normalize()
    .multiplyScalar(R + pos.distanceTo(hubPos)*.42);
  var curve=new THREE.QuadraticBezierCurve3(pos,mid,hubPos);
  var pts=curve.getPoints(48);
  var line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:0x4589ff,transparent:true,opacity:.6}));
  gGroup.add(line);
  var tr=new THREE.Mesh(new THREE.SphereGeometry(.032,10,10),
    new THREE.MeshBasicMaterial({color:0x78a9ff}));
  gGroup.add(tr);
  travellers.push({m:tr,curve:curve,off:i*0.11});
});
gGroup.rotation.y=2.66; gGroup.rotation.x=.40;

/* ── 인터랙션 ── */
var pointer={x:0,y:0}, drag={on:false,x:0,val:0,tgt:null};
window.addEventListener('pointermove',function(e){
  pointer.x=(e.clientX/window.innerWidth-.5);
  pointer.y=(e.clientY/window.innerHeight-.5);
  if(drag.on){ drag.val+=(e.clientX-drag.x)*.006; drag.x=e.clientX; }
});
[heroEl,vEl,gEl].forEach(function(c){
  c.addEventListener('pointerdown',function(e){ drag.on=true; drag.x=e.clientX; drag.tgt=c; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointerup',function(){ drag.on=false; });
  c.addEventListener('pointercancel',function(){ drag.on=false; });
});
var vis={hero:true,view:true,globe:true};
(function(){
  var map=[[heroEl,'hero'],[vEl,'view'],[gEl,'globe']];
  var io2=new IntersectionObserver(function(es){
    es.forEach(function(e){
      map.forEach(function(m){ if(m[0]===e.target) vis[m[1]]=e.isIntersecting; });
    });
  },{threshold:0});
  map.forEach(function(m){ io2.observe(m[0]); });
})();
var t0=performance.now();
function frame(now){
  var t=(now-t0)/1000;
  if(!reduce){
    heroGroup.rotation.y=t*.15+(drag.tgt===heroEl?drag.val:0);
    heroGroup.rotation.x=pointer.y*.1;
    heroGroup.position.y=Math.sin(t*.7)*.06;
    vGroup.rotation.y=t*.28+(drag.tgt===vEl?drag.val*1.2:0);
    vGroup.rotation.x=-.12+pointer.y*.05;
    gGroup.rotation.y=2.66+Math.sin(t*.12)*.16+(drag.tgt===gEl?drag.val:0);
    travellers.forEach(function(tv){
      var u=(t*.16+tv.off)%1;
      tv.m.position.copy(tv.curve.getPoint(u));
      tv.m.scale.setScalar(0.7+Math.sin(u*Math.PI)*0.9);
    });
  }
  if(swap>0) swap=Math.max(0,swap-.06);
  vGroup.scale.setScalar(1-Math.sin(swap*Math.PI)*.36);
  if(vis.hero) hero.renderer.render(hero.scene,hero.cam);
  if(vis.view) view.renderer.render(view.scene,view.cam);
  if(vis.globe) globe.renderer.render(globe.scene,globe.cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
