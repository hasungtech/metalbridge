import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * 파서 회귀 테스트.
 * 실제 견적의뢰 PDF를 올려 판독 결과가 유지되는지 확인합니다.
 * 기대값이 바뀌면 파서를 건드린 것입니다.
 */
const SAMPLE = 'tests/fixtures/견적의뢰_구매품_AL외.pdf';

/**
 * 파일을 #fileInput 에 붙입니다.
 * setInputFiles 가 조용히 실패하는 환경(브라우저 빌드 불일치)에서는
 * DataTransfer 로 직접 주입해 같은 change 경로를 태웁니다.
 */
async function attachSample(page) {
  // 필수 동의 없이는 업로드가 막힙니다 (개인정보 수집·이용 동의)
  const agree = page.locator('#agreeReq');
  if (await agree.count()) await agree.check();

  await page.setInputFiles('#fileInput', SAMPLE);
  const attached = await page.evaluate(() => document.getElementById('fileInput').files.length);
  if (attached > 0) return;

  const b64 = fs.readFileSync(SAMPLE).toString('base64');
  await page.evaluate((data) => {
    const bin = atob(data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([buf], '견적의뢰_구매품_AL외.pdf', { type: 'application/pdf' }));
    const el = document.getElementById('fileInput');
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, b64);
}

test('PDF 판독 — 품목 20건', async ({ page }) => {
  await page.goto('/');
  await attachSample(page);
  await page.waitForTimeout(8000);
  const meta = await page.textContent('#specMeta');
  expect(meta).toContain('20건');
  expect(await page.locator('#specBody .card').count()).toBe(20);
});

test('문답 후 발송 가능 건수 증가', async ({ page }) => {
  await page.goto('/');
  await attachSample(page);
  await page.waitForTimeout(8000);
  for (let i = 0; i < 14; i++) {
    const chips = page.locator('#askChips button');
    if (await chips.count()) {
      const t = await chips.first().innerText();
      if (t.includes('자료 더')) break;
      await chips.first().click();
    } else {
      await page.fill('#askIn', 'buyer@example.com');
      await page.click('#askSend');
    }
    await page.waitForTimeout(500);
  }
  const meta = await page.textContent('#specMeta');
  expect(meta).toMatch(/확정 1[0-9]/);
});

test('DOM 훅이 모두 존재', async ({ page }) => {
  await page.goto('/');
  for (const id of ['drop','fileInput','askLog','askChips','askIn','specBody','specMeta']) {
    await expect(page.locator('#' + id)).toHaveCount(1);
  }
  await expect(page.locator('.abub.sys')).toHaveCount(1);
});

test('동의 없이는 접수되지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.fill('#askIn', 'STS316L 판재 t12 4톤');
  await page.click('#askSend');
  await expect(page.locator('#consent')).toHaveClass(/warn/);

  await page.setInputFiles('#fileInput', SAMPLE);
  await page.waitForTimeout(3000);
  await expect(page.locator('#specBody .card')).toHaveCount(0);
});

/* ── 다국어 ── */

test('언어 전환 — 버튼 4개로 화면이 바뀐다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#langSw button')).toHaveCount(4);
  // 기본은 한국어 (playwright.config.js 에서 locale 을 ko-KR 로 고정)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

  const cases = [
    ['en', 'What we read', /Specialty metal sourcing/],
    ['ja', '読み取り結果', /特殊金属材料/],
    ['zh', '识别结果', /特殊金属材料询价/],
    ['ko', '판독 결과', /특수 소재 견적/],
  ];
  for (const [code, railLabel, title] of cases) {
    await page.click(`#langSw button[data-l="${code}"]`);
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await expect(page.locator('.rail-label')).toHaveText(railLabel);
    await expect(page).toHaveTitle(title);
  }
});

test('언어를 바꿔도 판독 결과는 그대로다', async ({ page }) => {
  await page.goto('/');
  await attachSample(page);
  await page.waitForSelector('#specBody .card', { timeout: 30000 });
  const before = await page.locator('#specBody .card').count();

  await page.click('#langSw button[data-l="en"]');
  await page.waitForTimeout(300);
  expect(await page.locator('#specBody .card').count()).toBe(before);
  // 상태 배지와 카드 라벨이 번역됩니다 (엔진 값은 한국어 그대로입니다)
  const tags = await page.$$eval('#specBody .tag', (els) => [...new Set(els.map((e) => e.textContent))]);
  for (const tag of tags) expect(['Confirmed', 'Conditional', 'Needs checking']).toContain(tag);
  await expect(page.locator('#specBody .cell .l').first()).toHaveText('Form');
});

test('언어 선택이 새로고침 뒤에도 남는다', async ({ page }) => {
  await page.goto('/');
  await page.click('#langSw button[data-l="ja"]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('.rail-label')).toHaveText('読み取り結果');
});

/* ── 자료 없이 대화만으로 접수 ── */

/** 칩이 있으면 누르고, 없으면 입력줄에 적어 보냅니다. */
async function answer(page, text) {
  const chip = page.locator(`#askChips button:has-text("${text}")`).first();
  if (await chip.count()) await chip.click();
  else { await page.fill('#askIn', text); await page.press('#askIn', 'Enter'); }
  await page.waitForTimeout(350);
}

/** 남은 문답을 끝까지 밀어 완료 블록을 띄웁니다. */
async function runToDone(page, fallback = '부산') {
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#doneBox').isVisible()) return true;
    const chips = page.locator('#askChips button');
    if (await chips.count()) await chips.first().click();
    else { await page.fill('#askIn', fallback); await page.press('#askIn', 'Enter'); }
    await page.waitForTimeout(350);
  }
  return page.locator('#doneBox').isVisible();
}

test('품목을 못 찾으면 소재·강종·형상·치수·수량을 묻는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  // 소재 이름만 적으면 파서가 품목으로 읽지 못합니다. 그때 대화로 채워야 합니다.
  await page.fill('#askIn', '알루미늄이 필요합니다');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);

  await answer(page, 'buyer@example.com');
  await expect(page.locator('.abub.sys').last()).toContainText('어떤 소재가 필요하십니까');
  await answer(page, '알루미늄');
  // 소재군을 고르면 그 소재의 강종만 나와야 합니다 (알루미늄에 SS400 이 뜨면 안 됩니다)
  await expect(page.locator('.abub.sys').last()).toContainText('어떤 강종입니까');
  const grades = await page.$$eval('#askChips button', (els) => els.map((e) => e.textContent));
  expect(grades).toContain('A6061-T6');
  expect(grades.join(' ')).not.toContain('SS400');
  await answer(page, 'A6061-T6');

  await expect(page.locator('.abub.sys').last()).toContainText('어떤 형태로');
  await answer(page, '판재');
  // 치수는 형상에 맞춰 나뉘어 나옵니다 — 판재면 두께 다음 폭×길이
  await expect(page.locator('.abub.sys').last()).toContainText('두께');
  await answer(page, '10');
  await expect(page.locator('.abub.sys').last()).toContainText('폭과 길이');
  await answer(page, '1000 × 2000');
  await expect(page.locator('.abub.sys').last()).toContainText('얼마나 필요하십니까');
  await answer(page, '20');
  await expect(page.locator('.abub.sys').last()).toContainText('단위');
  await answer(page, '장');

  // 대화 답변이 품목 한 줄이 됩니다 — 요청서에 넣을 내용이 생깁니다
  await expect(page.locator('#specBody .card')).toHaveCount(1);
  const card = await page.textContent('#specBody .card');
  expect(card).toContain('A6061-T6');
  expect(card).toContain('판재');
  expect(card).toContain('t10 × 1000 × 2000');
  await expect(page.locator('#specMeta')).toContainText('확정 1');
});

test('견적에 필요한 조건을 모두 묻는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  await page.fill('#askIn', 'STS316L 판재 1000x2000xt10 20장');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);

  // 단가를 좌우하는 항목이 빠지면 공급처가 되묻게 됩니다
  const want = ['용도', '표면·마감', '가공 범위', '공차', '성적서', '원산지', '인도 조건', '발주 형태'];
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#doneBox').isVisible()) break;
    const txt = await page.locator('.abub.sys').last().innerText();
    want.forEach((w) => { if (txt.includes(w)) seen.add(w); });
    const chips = page.locator('#askChips button');
    if (await chips.count()) await chips.first().click();
    else { await page.fill('#askIn', '부산'); await page.press('#askIn', 'Enter'); }
    await page.waitForTimeout(350);
  }
  expect([...seen].sort()).toEqual([...want].sort());

  // 스테인리스는 고용화 열처리가 기본이라 조질을 묻지 않습니다
  const all = (await page.$$eval('.abub.sys', (els) => els.map((e) => e.innerText))).join(' ');
  expect(all).not.toContain('열처리·조질');
});

test('접수에 실패해도 메일 앱을 열지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  await page.fill('#askIn', 'STS316L 판재 1000x2000xt10 20장');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);
  expect(await runToDone(page)).toBe(true);

  const before = page.url();
  await page.click('#sendStaff');
  await page.waitForTimeout(1500);
  // 환경변수가 없는 테스트 환경에서는 접수가 실패합니다. 메일 앱으로 넘기지 않습니다.
  expect(page.url()).toBe(before);
  await expect(page.locator('#doneState')).toContainText('접수되지 않았습니다');
  await expect(page.locator('.abub.sys').last()).toContainText('접수하지 못했습니다');
  // 다시 누를 수 있어야 합니다
  await expect(page.locator('#sendStaff')).toBeEnabled();
});

/* ── 소개 화면 취급 범위 ── */

test('소개 화면에 적은 소재는 모두 판별되고 공급처가 있다', async ({ page }) => {
  await page.goto('/');

  const line = await page.locator('.intro-facts dd').first().innerText();
  const words = line.split('·').map((w) => w.trim()).filter(Boolean);
  expect(words.length).toBeGreaterThanOrEqual(6);

  // 표기만 늘리고 판별이 못 따라가면 엉뚱한 공급처에 요청서가 나갑니다.
  const routed = await page.evaluate(async (list) => {
    const m = await import('/src/engine/suppliers.js');
    return list.map((w) => {
      const cat = m.catOf(w);
      return { w, cat, n: m.SUPPLIER_MASTER.filter((s) => s.cat.indexOf(cat) >= 0).length };
    });
  }, words);

  for (const r of routed) {
    // 못 알아본 낱말은 구조용강으로 떨어집니다 — 구조용강 자신 말고는 실패입니다
    if (r.w !== '구조용강') expect(r.cat, `${r.w} 판별 실패`).not.toBe('구조용강');
    expect(r.n, `${r.w} → ${r.cat} 공급처 없음`).toBeGreaterThan(0);
  }
});

test('소개 화면에 적은 형상은 모두 공급처가 있다', async ({ page }) => {
  await page.goto('/');

  // '절단 가공품' 은 형상이 아니라 가공 범위라 마스터의 sh 에 없습니다
  const line = await page.locator('.intro-facts dd').nth(1).innerText();
  const shapes = line.split('·').map((w) => w.trim()).filter((w) => w && !/절단/.test(w));
  expect(shapes.length).toBeGreaterThanOrEqual(5);

  const counts = await page.evaluate(async (list) => {
    const m = await import('/src/engine/suppliers.js');
    return list.map((sh) => ({
      sh, n: m.SUPPLIER_MASTER.filter((s) => s.sh.indexOf(sh) >= 0).length,
    }));
  }, shapes);
  for (const c of counts) expect(c.n, `${c.sh} 취급 공급처 없음`).toBeGreaterThan(0);
});

test('단조를 고르면 개략 치수와 단중을 묻는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  // 소재 이름만 적으면 품목이 안 잡혀 대화로 채웁니다
  await page.fill('#askIn', '스테인리스가 필요합니다');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);

  await answer(page, 'buyer@example.com');
  await answer(page, '스테인리스');
  await answer(page, 'STS316L');

  await expect(page.locator('.abub.sys').last()).toContainText('어떤 형태로');
  const shapes = await page.$$eval('#askChips button', (els) => els.map((e) => e.textContent.trim()));
  expect(shapes).toContain('단조');
  expect(shapes).toContain('주물');
  await answer(page, '단조');

  // 단조·주물은 도면 발주입니다 — 판재처럼 두께를 물으면 답이 안 나옵니다
  await expect(page.locator('.abub.sys').last()).toContainText('개략');
  await answer(page, 'Ø800 × H300');
  await expect(page.locator('.abub.sys').last()).toContainText('중량');
  await answer(page, '120');
  await expect(page.locator('.abub.sys').last()).toContainText('얼마나 필요하십니까');
  await answer(page, '4');
  await answer(page, '개(EA)');

  const card = await page.textContent('#specBody .card');
  expect(card).toContain('단조');
  expect(card).toContain('단중 120kg');

  // 단조를 취급하는 공급처가 실제로 붙어야 합니다
  const n = await page.evaluate(async () => {
    const m = await import('/src/engine/suppliers.js');
    return m.matchSuppliers().filter((x) => x.sp.sh.indexOf('단조') >= 0).length;
  });
  expect(n).toBeGreaterThan(0);
});

test('밀시트는 답이 없어도 요청서에 EN 10204 3.1 로 들어간다', async ({ page }) => {
  await page.goto('/');

  // 성적서 문항에 '불필요' 가 남아 있으면 소개 화면의 약속과 어긋납니다
  const opts = await page.evaluate(async () => {
    const d = await import('/src/i18n/ko.js');
    return d.default ? d.default.q.mtcO : d.ko.q.mtcO;
  });
  expect(opts).not.toContain('불필요');

  const spec = await page.evaluate(async () => {
    const e = await import('/src/engine/export-rfq.js');
    const s = await import('/src/state.js');
    const out = {};
    s.S.ANS.mtc = '';            out.empty = e.mtcSpec();
    s.S.ANS.mtc = '모르겠습니다'; out.unsure = e.mtcSpec();
    s.S.ANS.mtc = '3.2 입회검사'; out.chosen = e.mtcSpec();
    return out;
  });
  expect(spec.empty).toContain('EN 10204 3.1');
  expect(spec.unsure).toContain('EN 10204 3.1');
  expect(spec.chosen).toBe('3.2 입회검사');
});

test('취급 · 형상 · 원칙 세 줄이 4개 언어로 나온다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.intro-facts > div')).toHaveCount(3);

  for (const code of ['ko', 'en', 'ja', 'zh']) {
    await page.click(`#langSw button[data-l="${code}"]`);
    await page.waitForTimeout(200);
    const rows = await page.$$eval('.intro-facts > div', (els) =>
      els.map((e) => [e.querySelector('dt').textContent.trim(), e.querySelector('dd').textContent.trim()]));
    for (const [k, v] of rows) {
      expect(k.length, `${code} 라벨 비어 있음`).toBeGreaterThan(0);
      expect(v.split('·').length, `${code} 항목 부족`).toBeGreaterThanOrEqual(3);
    }
    // 한국어 식별자가 다른 언어 화면에 새지 않아야 합니다
    if (code !== 'ko') {
      const joined = rows.map((r) => r.join(' ')).join(' ');
      expect(joined).not.toContain('스테인리스');
    }
  }
});
