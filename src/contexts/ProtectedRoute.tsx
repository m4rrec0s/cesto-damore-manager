import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { useAdminCheck } from "./useAdminCheck";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  fallback,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { isAdmin, isChecking } = useAdminCheck();

  if (isLoading || (requireAdmin && isChecking)) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-500"></div>
        </div>
      )
    );
  }

  if (!user) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold text-neutral-950 mb-4">
            Acesso Negado
          </h1>
          <p className="text-neutral-700 mb-8">
            Você precisa estar autenticado para acessar esta página.
          </p>
          <a
            href="/login"
            className="bg-neutral-600 text-white px-6 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Ir para Login
          </a>
        </div>
      )
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold text-neutral-950 mb-4">
            Acesso Restrito
          </h1>
          <p className="text-neutral-700 mb-8">
            Você não tem permissão para acessar esta página. Apenas
            administradores podem acessá-la.
          </p>
          <a
            href="/dashboard"
            className="bg-neutral-600 text-white px-6 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Voltar para Dashboard
          </a>
        </div>
      )
    );
  }

  return <>{children}</>;
}
