import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Something went wrong
          </p>
          <h1 className="text-2xl font-semibold text-white">Unexpected application error</h1>
          <p className="max-w-md text-sm text-muted">{this.state.message}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={this.handleReset}>
              Try again
            </Button>
            <Button onClick={() => window.location.assign('/')}>Go home</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
