import { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)] text-center select-none"
        >
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[var(--card-bg)] border border-[var(--border)] shadow-2xl flex flex-col items-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center text-2xl font-bold">
              !
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text)]">
                مشکلی پیش آمد
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text2)] leading-relaxed">
                اطلاعات شما پاک نشده است. می‌توانید دوباره تلاش کنید یا صفحه را بارگذاری مجدد کنید.
              </p>
              <p className="text-[11px] text-[var(--text3)]" dir="ltr">
                Something went wrong. Your data is safe.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 min-w-[130px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-blue-600/20 active:scale-95"
              >
                تلاش دوباره
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-w-[130px] px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text)] text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95"
              >
                بارگذاری مجدد
              </button>
            </div>

            {this.state.error && (
              <details className="w-full text-right pt-2 border-t border-[var(--border)] text-xs text-[var(--text3)]">
                <summary className="cursor-pointer font-medium hover:text-[var(--text2)] transition-colors py-1">
                  جزئیات فنی
                </summary>
                <div
                  className="mt-2 p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] font-mono text-[11px] text-red-400 overflow-x-auto text-left selectable"
                  dir="ltr"
                >
                  {this.state.error.toString()}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
