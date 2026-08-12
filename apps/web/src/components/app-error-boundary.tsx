import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type State = { hasError: boolean };
const MAX_AUTO_REFRESH_ATTEMPTS = 2;

function getErrorRetryKey() {
  return `contactbook:error-refresh:${window.location.pathname}${window.location.search}`;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
    this.refreshCurrentPageIfPossible();
  }

  componentDidUpdate() {
    if (!this.state.hasError) {
      sessionStorage.removeItem(getErrorRetryKey());
    }
  }

  goHome = () => {
    window.location.assign("/");
  };

  refreshCurrentPageIfPossible = () => {
    const retryKey = getErrorRetryKey();
    const currentAttempts = Number(sessionStorage.getItem(retryKey) ?? "0");

    if (currentAttempts >= MAX_AUTO_REFRESH_ATTEMPTS) {
      return;
    }

    sessionStorage.setItem(retryKey, String(currentAttempts + 1));
    window.location.reload();
  };

  manualRefresh = () => {
    sessionStorage.removeItem(getErrorRetryKey());
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      sessionStorage.removeItem(getErrorRetryKey());
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Alert className="max-w-md">
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. ContactBook already tried refreshing
              this page automatically.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={this.manualRefresh}>Refresh</Button>
              <Button variant="outline" onClick={this.goHome}>
                Go home
              </Button>
            </div>
          </div>
        </Alert>
      </main>
    );
  }
}
