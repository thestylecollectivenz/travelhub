import * as React from 'react';

interface ErrorBoundaryProps {
  fallbackTitle?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 'var(--space-4)', color: 'var(--color-warning)' }}>
          <strong>{this.props.fallbackTitle || 'Something went wrong'}</strong>
          <div>{this.state.errorMessage}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
