import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { auth } from "../config/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useApi } from "../services/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  appToken: string | null;
  isLoading: boolean;
  login: (userData: User, appToken: string) => void;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [appToken, setAppToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedAppToken = localStorage.getItem("appToken");

      if (storedUser && storedAppToken) {
        try {
          const userData = JSON.parse(storedUser);
          // ⚠️ SEGURANÇA: Aceitar dados do localStorage mas NUNCA confiar no role
          // O role será sempre validado com o servidor
          setUser(userData);
          setAppToken(storedAppToken);
          console.log("✅ Usuário carregado do localStorage");
        } catch (e) {
          console.error("❌ Erro ao fazer parse do usuário armazenado", e);
          localStorage.removeItem("user");
          localStorage.removeItem("appToken");
        }
      } else {
        console.log("ℹ️  Nenhum usuário armazenado");
      }
    } catch (e) {
      console.error("❌ Erro ao acessar localStorage", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userData: User, token: string) => {
    setAppToken(token);
    setUser(userData);
    localStorage.setItem("appToken", token);

    // ⚠️ SEGURANÇA: NÃO salvar informações sensíveis como role no localStorage
    // O role será sempre validado com o servidor via useAdminCheck()
    // Apenas armazenar ID e informações públicas do usuário
    const safeUserData = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
    };
    localStorage.setItem("user", JSON.stringify(safeUserData));

    if (typeof document !== "undefined") {
      const expirationDate = new Date();
      expirationDate.setTime(
        expirationDate.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      document.cookie = `appToken=${token};expires=${expirationDate.toUTCString()};path=/`;
      document.cookie = `user=${JSON.stringify(
        safeUserData
      )};expires=${expirationDate.toUTCString()};path=/`;
    }
  };

  const logout = () => {
    setUser(null);
    setAppToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("appToken");
    localStorage.removeItem("token");
    api.logoutLocal();

    // Limpar cookies também
    if (typeof document !== "undefined") {
      document.cookie =
        "appToken=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/";
      document.cookie = "user=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/";
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (!auth) {
        throw new Error(
          "Firebase não foi inicializado corretamente. Verifique as variáveis de ambiente."
        );
      }

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await api.google(idToken, {
        email: result.user.email,
        name: result.user.displayName,
        imageUrl: result.user.photoURL,
      });

      if (response?.user && response?.appToken) {
        login(response.user, response.appToken);
      } else {
        throw new Error(
          "Resposta inválida do servidor: faltam dados de usuário ou token"
        );
      }
    } catch (error) {
      console.error("❌ Error logging in with Google", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: string }).code
          : "";
      const message =
        code === "auth/popup-closed-by-user"
          ? "Login cancelado"
          : errorMessage || "Erro ao fazer login";
      throw new Error(message);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, appToken, isLoading, login, logout, loginWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}
