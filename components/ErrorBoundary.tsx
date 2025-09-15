import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to the console with more structure for better readability
    console.groupCollapsed(`%c[ErrorBoundary] Caught an error: ${error.message}`, 'color: red; font-weight: bold;');
    console.error(error);
    console.log("React Component Stack:", errorInfo.componentStack);
    console.groupEnd();
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDbError = this.state.error?.message.includes('Could not open or delete the database');
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="text-center bg-surface p-6 sm:p-8 rounded-lg shadow-xl max-w-lg w-full border border-border">
                <Icon name="x-circle" className="w-16 h-16 text-red-500 mx-auto mb-4"/>
                <h1 className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-500 mb-4">
                  {isDbError ? 'Database Access Error' : 'Oops! Something went wrong.'}
                </h1>
                <p className="text-text-muted mb-6">
                  {isDbError 
                    ? "The application's local database has encountered a serious error and cannot be opened. This can sometimes happen after a browser update or if storage becomes corrupted." 
                    : "The application encountered an unexpected error. Please try reloading the page to continue."}
                </p>
                {isDbError && (
                  <div className="text-left bg-background p-4 rounded-md mb-6 border border-border">
                    <p className="font-semibold text-text mb-2">To fix this, you may need to manually clear the website data for this app in your browser settings.</p>
                    <p className="text-sm text-text-muted mt-2"><strong>Warning:</strong> This will permanently erase all your local decks, series, and progress.</p>
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-primary hover:underline font-medium">Show instructions for clearing site data</summary>
                      <ul className="list-disc list-inside text-text-muted mt-2 space-y-2 pt-2 border-t border-border">
                          <li><b>Chrome:</b> Settings &rarr; Privacy and security &rarr; Site Settings &rarr; View permissions and data stored across sites &rarr; Search for this site's URL &rarr; Clear data.</li>
                          <li><b>Firefox:</b> Settings &rarr; Privacy & Security &rarr; Cookies and Site Data &rarr; Manage Data... &rarr; Search for this site's URL &rarr; Remove Selected.</li>
                          <li><b>Safari:</b> Safari &rarr; Settings... &rarr; Privacy &rarr; Manage Website Data... &rarr; Search for this site's URL &rarr; Remove.</li>
                      </ul>
                    </details>
                     <p className="text-sm text-text-muted mt-4">After clearing the data, reloading this page should fix the issue. If you have a backup file, you can restore your data afterwards.</p>
                  </div>
                )}
                {!isDbError && this.state.error && (
                    <pre className="bg-background text-left text-xs text-red-500 dark:text-red-400 p-4 rounded-md overflow-x-auto mb-6">
                        <code>{this.state.error.stack || this.state.error.toString()}</code>
                    </pre>
                )}
                <Button variant="danger" onClick={this.handleReload}>
                    Reload Page
                </Button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;