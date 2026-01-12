import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { useAdminCheck } from "./useAdminCheck";
import { Layout } from "../components/Layout";

interface AdminRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * AdminRoute - Rota que requer validação REAL de admin
 *
 * ✅ SEGURANÇA CRÍTICA:
 * - Valida SEMPRE com o servidor
 * - Impossível de falsificar modificando localStorage
 * - Se role for alterado no localStorage, servidor ainda nega acesso
 *
 * Uso:
 * <AdminRoute>
 *   <Dashboard />
 * </AdminRoute>
 */
export function AdminRoute({ children, fallback }: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const { isAdmin, isChecking, error } = useAdminCheck();

  // Enquanto carrega, mostrar loading
  if (isLoading || isChecking) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full animate-spin border-4 border-neutral-200 border-t-neutral-900" />
            <p className="text-neutral-600 font-medium">Validando acesso...</p>
          </div>
        </div>
      )
    );
  }

  // Se não autenticado
  if (!user) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-950 mb-4">
              Acesso Negado
            </h1>
            <p className="text-neutral-700 mb-8">
              Você precisa estar autenticado para acessar esta página.
            </p>
            <a
              href="/login"
              className="inline-block bg-neutral-900 text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Ir para Login
            </a>
          </div>
        </div>
      )
    );
  }

  // Se não é admin (validação do servidor)
  if (!isAdmin) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              🚫 Acesso Restrito
            </h1>
            <p className="text-neutral-700 mb-4">
              Você não tem permissão para acessar esta página.
            </p>
            <p className="text-sm text-neutral-500 mb-8">
              Apenas administradores podem acessá-la.
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-4">
                Erro na validação: {error}
              </p>
            )}
            <a
              href="/login"
              className="inline-block bg-neutral-900 text-white px-6 py-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Voltar
            </a>
          </div>
        </div>
      )
    );
  }

  // ✅ Todas as validações passaram - renderizar com Layout
  return <Layout>{children}</Layout>;
}
