import { test, expect } from '@playwright/test';

/**
 * 파서 회귀 테스트.
 * 실제 견적의뢰 PDF를 올려 판독 결과가 유지되는지 확인합니다.
 * 기대값이 바뀌면 파서를 건드린 것입니다.
 */
const SAMPLE = 'tests/fixtures/견적의뢰_구매품_AL외.pdf';

test('PDF 판독 — 품목 20건', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#fileInput', SAMPLE);
  await page.waitForTimeout(6000);
  const meta = await page.textContent('#specMeta');
  expect(meta).toContain('품목 20건');
});

test('문답 후 발송 가능 건수 증가', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#fileInput', SAMPLE);
  await page.waitForTimeout(6000);
  for (let i = 0; i < 12; i++) {
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
});
