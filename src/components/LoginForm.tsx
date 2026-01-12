import React, { useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import type { User } from "../types";
import { useApi } from "../services/api";

export function LoginForm() {
  const { loginWithGoogle, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [useEmailLogin, setUseEmailLogin] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const api = useApi();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await loginWithGoogle();
      // Redirecionar para home após login bem-sucedido
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error?.message || "Erro ao fazer login com Google");
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.login({ email, password });

      if (result.requires2FA) {
        setShow2FA(true);
        setLoading(false);
      } else if (result.user && result.token) {
        login(result.user, result.token);
        navigate("/");
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.response?.data?.error || error.message || "Erro ao fazer login");
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.verify2FA(email, twoFactorCode);
      if (result.user && result.appToken) {
        login(result.user, result.appToken);
        navigate("/");
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (error: any) {
      console.error("2FA error:", error);
      setError(error.response?.data?.error || error.message || "Código inválido ou expirado");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50/50 p-6">
      <div className="max-w-md w-full">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-neutral-100">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-neutral-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-neutral-200">
              C
            </div>
          </div>
          <h1 className="text-3xl font-black text-neutral-950 text-center mb-2">
            Cesto D'Amore
          </h1>
          <p className="text-neutral-600 text-center text-sm font-medium uppercase tracking-wider mb-8">
            Manager Panel
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {!useEmailLogin ? (
            <>
              <p className="text-neutral-400 font-medium mb-6 text-center">
                Faça login para acessar o painel
              </p>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-400 text-white font-bold py-3 rounded-2xl transition-colors duration-200 flex items-center justify-center gap-2 mb-4"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Login com Google
                  </>
                )}
              </button>
              <button
                onClick={() => setUseEmailLogin(true)}
                className="w-full text-neutral-600 font-semibold py-2 hover:text-neutral-700"
              >
                ou use email/senha
              </button>
            </>
          ) : show2FA ? (
            <>
              <p className="text-neutral-950 font-bold mb-6 text-center">
                Verificação de Duas Etapas
              </p>
              <p className="text-neutral-600 text-sm mb-6 text-center">
                Insira o código de 6 dígitos enviado para o seu email.
              </p>
              <form onSubmit={handle2FAVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Código de Verificação
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-600 text-center text-2xl tracking-[1em] font-bold"
                    placeholder="000000"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="w-full bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-400 text-white font-bold py-3 rounded-2xl transition-colors duration-200"
                >
                  {loading ? "Verificando..." : "Confirmar"}
                </button>
              </form>
              <button
                onClick={() => {
                  setShow2FA(false);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full text-neutral-600 font-semibold py-2 hover:text-neutral-700 mt-4"
              >
                voltar ao login
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-400 text-white font-bold py-3 rounded-2xl transition-colors duration-200"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
              <button
                onClick={() => {
                  setUseEmailLogin(false);
                  setError("");
                }}
                className="w-full text-neutral-600 font-semibold py-2 hover:text-neutral-700 mt-4"
              >
                voltar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
