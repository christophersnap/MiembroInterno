import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global Error:', { message, source, lineno, colno, error });
};

window.onunhandledrejection = (event) => {
  let reasonMsg = 'Unknown reason';
  if (event.reason instanceof Error) {
    reasonMsg = event.reason.message;
  } else if (event.reason !== undefined && event.reason !== null) {
    reasonMsg = typeof event.reason === 'object' ? JSON.stringify(event.reason) : String(event.reason);
  } else {
    reasonMsg = 'Empty Rejection (undefined/null)';
  }
  console.error('Unhandled Rejection:', reasonMsg);
};

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'cv_chunk_reload_ts';
  const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem(reloadKey, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
