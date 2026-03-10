import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  fallbackMessage?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Что-то пошло не так</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {this.props.fallbackMessage ??
            "Попробуйте обновить страницу или вернуться в приложение."}
        </p>
      </div>
    );
  }
}
