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
