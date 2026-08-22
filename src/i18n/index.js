/** 다국어 — 한국어·영어·일본어·중국어(간체)
 *
 *  규칙
 *  - 사전은 `ko` 가 기준입니다. 다른 언어에 키가 없으면 한국어로 떨어집니다
 *  - **엔진은 한국어 값을 그대로 유지합니다.** `it.state` 의 `확정/조건부/불가`,
 *    `it.issues` 의 `강종 미기재` 같은 값은 코드가 비교에 쓰는 식별자입니다.
 *    번역은 화면에 그릴 때만 합니다 (`spec-table.js` 의 `stateLabel`·`issueText`)
 *  - 요청서 엑셀과 DB 는 한국어 그대로입니다. 받는 사람이 담당자·국내 공급처입니다
 *  - 문답 선택지는 `{v, t}` 입니다. `v` 가 한국어 식별자, `t` 가 화면 문구입니다
 */
import { S } from '../state.js';
import ko from './ko.js';
import en from './en.js';
import ja from './ja.js';
import zh from './zh.js';

const DICT = { ko, en, ja, zh };
export const LANGS = [
  { k: 'ko', short: 'KO', name: '한국어' },
  { k: 'en', short: 'EN', name: 'English' },
  { k: 'ja', short: 'JA', name: '日本語' },
  { k: 'zh', short: 'ZH', name: '中文' },
];
const KEY = 'mb.lang';
const listeners = [];

function pick(dict, key) {
  return key.split('.').reduce(function (o, k) {
    return o == null ? undefined : o[k];
  }, dict);
}

/** t('a.b', {n:3}) — 없는 키는 한국어로, 그것도 없으면 키를 그대로 돌려줍니다. */
export function t(key, vars) {
  var v = pick(DICT[S.lang] || ko, key);
  if (v == null) v = pick(ko, key);
  if (v == null) return key;
  if (typeof v !== 'string' || !vars) return v;
  return v.replace(/\{(\w+)\}/g, function (m, k) {
    return vars[k] == null ? m : vars[k];
  });
}

export function lang() { return S.lang; }
export function onLangChange(fn) { listeners.push(fn); }

/** 브라우저 언어에서 고릅니다. zh-TW·zh-HK 도 간체로 보냅니다 (별도 번체본 없음). */
function detect() {
  try {
    var saved = localStorage.getItem(KEY);
    if (saved && DICT[saved]) return saved;
  } catch (e) { /* 사생활 보호 모드 */ }
  var n = (navigator.language || 'ko').toLowerCase();
  if (n.indexOf('ja') === 0) return 'ja';
  if (n.indexOf('zh') === 0) return 'zh';
  if (n.indexOf('ko') === 0) return 'ko';
  return 'en';
}

/** data-i18n 붙은 노드를 현재 언어로 다시 씁니다. */
export function applyStatic(root) {
  var r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.dataset.i18n);
  });
  r.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  r.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    el.placeholder = t(el.dataset.i18nPh);
  });
  r.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

function paintMeta() {
  document.documentElement.lang = S.lang;
  document.title = t('meta.title');
  var d = document.querySelector('meta[name="description"]');
  if (d) d.setAttribute('content', t('meta.desc'));
}

export function setLang(l) {
  if (!DICT[l] || l === S.lang) return;
  S.lang = l;
  try { localStorage.setItem(KEY, l); } catch (e) { /* 사생활 보호 모드 */ }
  paintMeta();
  applyStatic();
  paintSwitch();
  listeners.forEach(function (fn) { try { fn(l); } catch (e) { console.warn(e); } });
}

function paintSwitch() {
  var sw = document.getElementById('langSw');
  if (!sw) return;
  Array.prototype.forEach.call(sw.children, function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.l === S.lang));
  });
}

export function initLang() {
  S.lang = detect();
  var sw = document.getElementById('langSw');
  if (sw) {
    sw.innerHTML = LANGS.map(function (l) {
      return '<button type="button" class="mono" data-l="' + l.k +
        '" lang="' + l.k + '" title="' + l.name + '" aria-pressed="false">' + l.short + '</button>';
    }).join('');
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setLang(b.dataset.l);
    });
  }
  paintMeta();
  applyStatic();
  paintSwitch();
}
