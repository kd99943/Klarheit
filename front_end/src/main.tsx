import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';
import {initAnalytics} from './services/analytics';

// 启动埋点采集层. 未配置 VITE_GA_MEASUREMENT_ID 时仅 console.debug, 不发外部请求.
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
