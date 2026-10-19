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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
