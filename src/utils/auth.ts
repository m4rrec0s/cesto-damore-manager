// Utilitários para segurança e autenticação
// ⚠️ IMPORTANTE: Validações de segurança CRÍTICAS devem ser feitas no BACKEND
// Este arquivo é apenas para UX (evitar navegação desnecessária)

// Função para decodificar JWT (apenas para verificar expiração)
export function decodeJWT(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Função para verificar se o token está expirado
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true; // Se não conseguir decodificar ou não tem exp, considera expirado
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
}

// ⚠️ DEPRECATED: NÃO USE MAIS
// @deprecated Use useAdminCheck() do contexto em vez disso
// Verificações de role NO CLIENTE são inseguras e podem ser falsificadas
// NUNCA confie apenas em dados do localStorage para controle de acesso
export function isUserAdmin(userString: string | null): boolean {
  console.warn(
    "⚠️ isUserAdmin() é inseguro. Use useAdminCheck() do contexto em vez disso."
  );
  if (!userString) return false;

  try {
    const user = JSON.parse(userString);
    // ❌ INSEGURO: Role pode ser falsificado no cliente
    // Esta função existe apenas para compatibilidade com código legado
    // O backend DEVE validar isso independentemente em TODA requisição
    return user.role === "admin" || user.role === "ADMIN";
  } catch {
    return false;
  }
}

// Verificar se o usuário está autenticado
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem("appToken");
  const user = localStorage.getItem("user");

  return !!(token && user && !isTokenExpired(token));
}

// Fazer logout
export function logout() {
  localStorage.removeItem("appToken");
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Redirecionar para login
  window.location.href = "/login";
}
