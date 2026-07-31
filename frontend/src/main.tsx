import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { subscribeSystemTheme } from '@/store/theme.store';
import '@/styles/theme.css';
import '@/styles/index.css';

subscribeSystemTheme();

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
