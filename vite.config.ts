import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 빌드 결과(dist/index.html)를 정적 서버 없이 파일로 바로 열어도 동작하게 한다.
 * 브라우저는 file:// 에서 type="module"·crossorigin 인 스크립트와 스타일을 CORS 로 막으므로,
 * 하나의 일반(classic) 스크립트로 묶고 해당 속성을 뗀다. 개발 서버(vite)에는 적용하지 않는다.
 */
const fileProtocolFriendly = (): Plugin => ({
  name: 'file-protocol-friendly',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace(/<script type="module" crossorigin /g, '<script defer ').replace(/ crossorigin/g, ''),
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), fileProtocolFriendly()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300000,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    modulePreload: false,
    // 한 파일(IIFE)로 묶는다: file:// 에서는 동적 import(코드 분할)도 막힌다. 코드에도 동적 import 를 쓰지 않는다.
    rollupOptions: { output: { format: 'iife' } },
  },
});
