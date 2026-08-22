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
/* ── 인터랙션 ── */
var pointer={x:0,y:0}, drag={on:false,x:0,val:0,tgt:null};
window.addEventListener('pointermove',function(e){
  pointer.x=(e.clientX/window.innerWidth-.5);
  pointer.y=(e.clientY/window.innerHeight-.5);
  if(drag.on){ drag.val+=(e.clientX-drag.x)*.006; drag.x=e.clientX; }
});
[heroEl].forEach(function(c){
  c.addEventListener('pointerdown',function(e){ drag.on=true; drag.x=e.clientX; drag.tgt=c; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointerup',function(){ drag.on=false; });
  c.addEventListener('pointercancel',function(){ drag.on=false; });
});
var vis={hero:true};
(function(){
  var map=[[heroEl,'hero']];
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
  }
  if(vis.hero) hero.renderer.render(hero.scene,hero.cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
