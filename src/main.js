import './styles/tokens.css';
import './styles/base.css';
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
initReveal();
renderSpec();
initChat();
initMisc();
syncHero();
try { initScene(); } catch (e) { console.warn('3D 비활성화:', e.message); }
