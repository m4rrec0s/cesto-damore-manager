import { useCallback, useEffect, useState } from "react";
import { useApi } from "../services/api";
import { useAuth } from "./useAuth";

interface UseAdminCheckResult {
  isAdmin: boolean;
  isChecking: boolean;
  error: string | null;
}

export function useAdminCheck(): UseAdminCheckResult {
  const { user } = useAuth();
  const api = useApi();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    if (!user?.id) {
      setIsAdmin(false);
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      setError(null);

      // Busca o perfil completo do usuário do servidor
      // O servidor retorna o role REAL do banco de dados
      // ✅ Impossível de falsificar: vem diretamente do backend
      const currentUser = await api.getUser(user.id);

      const adminRoles = ["admin", "ADMIN"];
      setIsAdmin(adminRoles.includes(currentUser.role || ""));
    } catch (err) {
      console.error("❌ Erro ao verificar status de admin:", err);
      setIsAdmin(false);
      setError(
        err instanceof Error ? err.message : "Erro ao verificar permissões"
      );
    } finally {
      setIsChecking(false);
    }
  }, [user?.id, api]);

  // 🔍 Validação inicial
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // 🚨 Detectar alterações no localStorage (tentativa de falsificação)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Se alguém alterou 'user' no localStorage, re-validar
      if (event.key === "user" || event.key === "appToken") {
        console.warn(
          "⚠️ localStorage foi alterado, re-validando permissões..."
        );
        checkAdminStatus();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAdminStatus]);


  return { isAdmin, isChecking, error };
}
