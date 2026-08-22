import './styles/tokens.css';
import './styles/base.css';
import { initLang, onLangChange } from './i18n/index.js';
import { initReveal } from './ui/reveal.js';
import { initScene } from './ui/scene3d.js';
import { initChat }  from './ui/chat.js';
import { initMisc, syncHero } from './ui/misc.js';
import { renderSpec } from './ui/spec-table.js';

/**
 * 화면 조립 지점.
 * 디자인이 바뀌어도 이 파일과 DOM 훅 7개만 맞으면 엔진은 그대로 붙습니다.
 *   #drop #fileInput #askLog #askChips #askIn #specBody #specMeta
 */
initLang();          // 언어 먼저 — 이후 모듈이 t() 로 문구를 만듭니다
initReveal();
renderSpec();
initChat();
initMisc();
syncHero();
try { initScene(); } catch (e) { console.warn('3D 비활성화:', e.message); }

/* 언어를 바꾸면 JS 가 만든 화면도 다시 그립니다.
   정적 문구는 i18n 이 data-i18n 노드를 직접 고치지만, 판독 레일과 상단 상태는
   여기서 다시 그려야 합니다. 이미 오간 대화 말풍선은 그대로 둡니다 —
   다시 그리면 지난 문답이 복제되고, 기록으로서도 그때 언어가 맞습니다. */
onLangChange(function () {
  renderSpec();
  syncHero();
});
