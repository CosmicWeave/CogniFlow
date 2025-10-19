import React from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="text-center bg-surface p-8 rounded-lg shadow-xl max-w-lg w-full border border-border">
            <Icon name="x-circle" className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-text-muted mb-6">
              An unexpected error occurred. Please try reloading the page. If the problem persists, you may need to clear your application data.
            </p>
            {this.state.error && (
              <details className="text-left bg-background p-4 rounded-md mb-6">
                <summary className="cursor-pointer text-sm text-text-muted">Error Details</summary>
                <pre className="mt-2 text-xs text-red-400 whitespace-pre-wrap break-all">
                  <code>{this.state.error.stack || this.state.error.toString()}</code>
                </pre>
              </details>
            )}
            <Button variant="danger" onClick={this.handleReload}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    
    // FIX: Correctly return children from props to render the component tree.
    return this.props.children;
  }
}

export default ErrorBoundary;
