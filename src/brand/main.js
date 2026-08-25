/** 브랜드 리소스 페이지 — 외부 협업자용 공개 발췌.
 *  내용의 원본은 design/BRAND_STORYBOOK.md 입니다. 여기와 어긋나면 그쪽이 맞습니다.
 *  동작은 색상 칩의 HEX 복사 하나뿐입니다. */
import '../styles/tokens.css';
import '../styles/base.css';
import '../legal/legal.css';
import './brand.css';

document.querySelectorAll('.sw').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var hex = btn.dataset.hex;
    var done = function () {
      btn.classList.add('copied');
      setTimeout(function () { btn.classList.remove('copied'); }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hex).then(done, function () {});
    }
  });
});
