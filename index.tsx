
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';
import { SettingsProvider } from './contexts/SettingsContext.tsx';
import { RouterProvider } from './contexts/RouterContext.tsx';
import { ModalProvider } from './contexts/ModalContext.tsx';
import DataManagementRoot from './components/DataManagementRoot.tsx';

// --- Global Error Handling ---
function logError(type: string, error: any, extraInfo: object = {}) {
  const isErrorObject = error instanceof Error;
  
  console.groupCollapsed(`%c[${type}] ${isErrorObject ? error.message : 'An error occurred'}`, 'color: red; font-weight: bold;');
  console.error(error);

  if (Object.keys(extraInfo).length > 0) {
    console.log('Additional Info:', extraInfo);
  }

  if (isErrorObject && error.stack) {
    // The stack is often part of the error object logged above, but logging separately can be useful.
    console.log('Stack Trace:', error.stack);
  }
  
  console.groupEnd();
}

window.addEventListener('error', (event) => {
  logError('Unhandled Global Error', event.error || event.message, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled Promise Rejection', event.reason);
});

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
            <ModalProvider>
              <DataManagementRoot>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </DataManagementRoot>
            </ModalProvider>
          </RouterProvider>
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
