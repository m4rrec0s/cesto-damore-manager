import React from "react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("🔴 Erro capturado pelo ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50/50 p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold text-neutral-950 mb-4">
              ⚠️ Algo deu errado
            </h1>
            <p className="text-neutral-700 mb-4">
              Desculpe, ocorreu um erro ao carregar a aplicação.
            </p>
            <details className="text-sm text-neutral-600 mb-4 p-3 bg-neutral-50 rounded-lg">
              <summary className="cursor-pointer font-medium">
                Detalhes do erro
              </summary>
              <pre className="mt-2 text-xs overflow-auto max-h-40">
                {this.state.error?.message}
              </pre>
            </details>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-neutral-600 text-white py-2 rounded-lg hover:bg-neutral-700 transition-colors font-medium"
            >
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
