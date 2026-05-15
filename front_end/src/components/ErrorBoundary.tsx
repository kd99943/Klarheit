import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-surface-offwhite px-6 py-20">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <span className="text-2xl text-red-400">!</span>
            </div>
            <h1 className="text-xl font-display font-medium text-brand-primary mb-3">
              {i18n.t("error.somethingWentWrong", { ns: "common" })}
            </h1>
            <p className="text-sm text-slate-500 mb-8">
              {i18n.t("error.unexpectedError", { ns: "common" })}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              {i18n.t("error.refreshPage", { ns: "common" })}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
