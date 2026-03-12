"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "login" | "register" | "forgot";

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me");
        const data = (await response.json()) as { user?: AuthUser | null };
        if (data.user) {
          router.replace("/");
        }
      } catch {
        // Ignora e mantem usuario na tela de login.
      }
    }

    checkSession();
  }, [router]);

  async function handleLogin() {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { message?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao fazer login.");
      }

      router.replace("/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Falha ao fazer login.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = (await response.json()) as { message?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao cadastrar.");
      }

      router.replace("/");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Falha ao cadastrar.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotRequest() {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setDevCodeHint(null);

    try {
      const response = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as { message?: string; detail?: string; devCode?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao solicitar recuperacao.");
      }

      setMessage(data.message ?? "Codigo enviado.");
      setDevCodeHint(data.devCode ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao solicitar recuperacao.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotReset() {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });

      const data = (await response.json()) as { message?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao redefinir senha.");
      }

      setMessage(data.message ?? "Senha redefinida com sucesso.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setResetCode("");
      setNewPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Falha ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(20,20,20,0.08)] lg:grid-cols-[1.15fr_1fr]">
        <div className="relative flex flex-col justify-between bg-gradient-to-b from-zinc-900 to-zinc-800 p-8 text-zinc-100 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.10),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_35%)]" />
          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-300 uppercase">Sales Behavior AI</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Conferencia de pedidos com padrao SaaS profissional.</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-300">
              Ambiente seguro para cadastro, login e acompanhamento de analises de pedido com regras
              comerciais e apoio de IA.
            </p>
          </div>
          <div className="relative mt-10 space-y-3 text-sm text-zinc-300">
            <p>1. Crie sua conta</p>
            <p>2. Acesse com email e senha</p>
            <p>3. Confira pedidos e risco em minutos</p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6 inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "login" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "register" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Cadastrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "forgot" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Esqueci senha
            </button>
          </div>

          <div className="space-y-4">
            {mode === "register" ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
              />
            ) : null}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
            />

            {(mode === "login" || mode === "register") ? (
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Senha"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
              />
            ) : null}

            {mode === "register" ? (
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirmar senha"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
              />
            ) : null}

            {mode === "forgot" ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="Codigo de 6 digitos"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleForgotRequest}
                    disabled={isLoading}
                    className="shrink-0 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60"
                  >
                    Enviar codigo
                  </button>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nova senha"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900"
                />
              </>
            ) : null}

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {devCodeHint ? <p className="text-xs text-zinc-500">Ambiente dev: codigo {devCodeHint}</p> : null}

            {mode === "login" ? (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>
            ) : null}

            {mode === "register" ? (
              <button
                type="button"
                onClick={handleRegister}
                disabled={isLoading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {isLoading ? "Criando conta..." : "Criar conta"}
              </button>
            ) : null}

            {mode === "forgot" ? (
              <button
                type="button"
                onClick={handleForgotReset}
                disabled={isLoading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {isLoading ? "Redefinindo..." : "Redefinir senha"}
              </button>
            ) : null}

            <p className="pt-2 text-center text-xs text-zinc-500">
              Ao continuar, voce concorda com o uso interno da plataforma.
            </p>
            <p className="text-center text-xs text-zinc-500">
              Precisa de ajuda? <Link href="/" className="font-medium text-zinc-700 underline underline-offset-2">Acessar ferramenta</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
