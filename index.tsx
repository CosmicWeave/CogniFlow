import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { RouterProvider } from './contexts/RouterContext';

// --- Global Error Handling ---
window.addEventListener('error', (event) => {
  console.error('Unhandled global error:', event.error, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
// --- End Global Error Handling ---

console.log(window.location);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SettingsProvider>
          <RouterProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </RouterProvider>
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);