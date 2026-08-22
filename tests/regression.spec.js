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
  await page.waitForTimeout(400);
}

test('품목을 못 찾으면 소재·형상·치수·수량을 묻는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  // 소재 이름만 적으면 파서가 품목으로 읽지 못합니다. 그때 대화로 채워야 합니다.
  await page.fill('#askIn', '알루미늄이 필요합니다');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);

  await answer(page, 'buyer@example.com');
  await expect(page.locator('.abub.sys').last()).toContainText('어떤 소재가 필요하십니까');
  await answer(page, '알루미늄');
  await expect(page.locator('.abub.sys').last()).toContainText('어떤 형태로');
  await answer(page, '판재');
  await expect(page.locator('.abub.sys').last()).toContainText('치수를 알려주십시오');
  await answer(page, '1000 × 2000 × t10');
  await expect(page.locator('.abub.sys').last()).toContainText('얼마나 필요하십니까');
  await answer(page, '20장');

  // 대화 답변이 품목 한 줄이 됩니다 — 요청서에 넣을 내용이 생깁니다
  await expect(page.locator('#specBody .card')).toHaveCount(1);
  const card = await page.textContent('#specBody .card');
  expect(card).toContain('알루미늄');
  expect(card).toContain('판재');
  expect(card).toContain('20장');
  await expect(page.locator('#specMeta')).toContainText('확정 1');
});

test('접수에 실패해도 메일 앱을 열지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.check('#agreeReq');
  await page.fill('#askIn', 'STS316L 판재 1000x2000xt10 20장');
  await page.press('#askIn', 'Enter');
  await page.waitForTimeout(600);
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#doneBox').isVisible()) break;
    const chips = page.locator('#askChips button');
    if (await chips.count()) await chips.first().click();
    else { await page.fill('#askIn', '부산'); await page.press('#askIn', 'Enter'); }
    await page.waitForTimeout(400);
  }
  await expect(page.locator('#doneBox')).toBeVisible();

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
