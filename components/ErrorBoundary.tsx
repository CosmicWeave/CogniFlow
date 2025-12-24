
import React, { ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch rendering errors and display a fallback UI.
 * Inherits from React.Component to use lifecycle methods for error handling.
 */
/* FIX: Explicitly extending React.Component to ensure properties like setState and props are inherited correctly in all environments. */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Initial state setup
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  /**
   * Static method to update state when an error occurs during rendering.
   */
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  /**
   * Lifecycle method to perform logging or side effects when an error is caught.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    /* FIX: Correctly accessing setState inherited from React.Component. */
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyReport = () => {
    const { error, errorInfo } = this.state;
    const report = `
Error Report
Date: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.toString()}

Stack Trace:
${error?.stack}

Component Stack:
${errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(report).then(() => {
        alert("Error report copied to clipboard.");
    }).catch(err => {
        console.error("Failed to copy report:", err);
        alert("Failed to copy report to clipboard.");
    });
  };

  /**
   * Renders the children or the fallback error UI.
   */
  public render(): ReactNode {
    const { hasError, error } = this.state;
    /* FIX: Correctly accessing props inherited from React.Component. */
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="text-center bg-surface p-8 rounded-lg shadow-xl max-w-lg w-full border border-border">
            <Icon name="x-circle" className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-text-muted mb-6">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {error && (
              <details className="text-left bg-background p-4 rounded-md mb-6 overflow-auto max-h-64">
                <summary className="cursor-pointer text-sm text-text-muted font-bold">Error Details</summary>
                <pre className="mt-2 text-xs text-red-400 whitespace-pre-wrap break-all">
                  <code>{error.toString()}</code>
                </pre>
              </details>
            )}
            <div className="flex flex-wrap gap-4 justify-center">
                <Button variant="secondary" onClick={this.handleCopyReport}>
                    <Icon name="file-text" className="w-4 h-4 mr-2" />
                    Copy Report
                </Button>
                <Button variant="danger" onClick={this.handleReload}>
                    <Icon name="refresh-ccw" className="w-4 h-4 mr-2" />
                    Reload Page
                </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return children;
  }
}

export default ErrorBoundary;
