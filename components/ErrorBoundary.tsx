import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';

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
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center bg-surface p-8 rounded-lg shadow-xl max-w-md w-full">
                <h1 className="text-3xl font-bold text-red-600 dark:text-red-500 mb-4">Oops! Something went wrong.</h1>
                <p className="text-text-muted mb-6">The application encountered an unexpected error. Please try reloading the page to continue.</p>
                {this.state.error && (
                    <pre className="bg-background text-left text-xs text-red-500 dark:text-red-400 p-4 rounded-md overflow-x-auto mb-6">
                        <code>{this.state.error.toString()}</code>
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