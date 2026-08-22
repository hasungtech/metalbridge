/** 스크롤 리빌 · 진행바 */
export function initReveal(){
function revealPass(){
  var vh = window.innerHeight;
  document.querySelectorAll('.rv:not(.in)').forEach(function(el){
    var r = el.getBoundingClientRect();
    if(r.top < vh*0.92 && r.bottom > 0) el.classList.add('in');
  });
}
var io = new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('in'); });
},{threshold:0, rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });
var prog = document.getElementById('progress');
function onScroll(){
  var h = document.documentElement.scrollHeight - window.innerHeight;
  prog.style.width = (h>0 ? (window.scrollY/h)*100 : 0) + '%';
  revealPass();
}
window.addEventListener('scroll', onScroll, {passive:true});
window.addEventListener('resize', revealPass);
onScroll();
}
