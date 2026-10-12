/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    // 开发环境代理：将 /api 请求转发到后端 Spring Boot 服务。
    // 这样前端 API base URL 可使用相对路径 /api/v1，避免跨域和硬编码 localhost 问题。
    // 生产环境由 nginx 反代，配置一致。
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Three.js 库本身较大（gzip 后约 150KB），属于 AR 功能依赖，按需异步加载。
    // 调高警告阈值以消除误导性警告；真正的优化方向是按需 import three 的子模块。
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-mediapipe': ['@mediapipe/tasks-vision'],
          'vendor-motion': ['motion'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
});
