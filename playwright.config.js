import { defineConfig } from '@playwright/test';

/* 브라우저 경로를 환경변수로 넘길 수 있게 해둡니다.
   설치된 Chromium 빌드가 Playwright 가 기대하는 것과 다른 환경(컨테이너 등)에서
   PW_CHROMIUM_PATH=/path/to/chrome npm test 로 실행할 수 있습니다. */
const exe = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5173',
    /* 기준 언어를 한국어로 고정합니다. i18n 이 브라우저 언어를 따라가므로
       고정하지 않으면 실행 환경에 따라 화면 문구가 달라져 기대값이 흔들립니다. */
    locale: 'ko-KR',
    ...(exe ? { launchOptions: { executablePath: exe } } : {}),
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
