"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { registerFormSchema } from "@/lib/validation/auth";

type Mode = "login" | "register" | "forgot";

type ApiResponsePayload = {
  message?: string;
  detail?: string;
  devCode?: string;
};

async function parseApiResponse(response: Response): Promise<ApiResponsePayload> {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as ApiResponsePayload;
  } catch {
    return {
      detail: "Resposta invalida do servidor.",
    };
  }
}

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

function getRegisterValidationMessage(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  const parsed = registerFormSchema.safeParse(input);
  if (parsed.success) {
    return null;
  }

  return parsed.error.issues[0]?.message ?? "Dados de cadastro invalidos.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Exclude<Mode, "forgot">>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForgotFlow, setShowForgotFlow] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverNewPassword, setRecoverNewPassword] = useState("");
  const [recoverConfirmPassword, setRecoverConfirmPassword] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverDevCodeHint, setRecoverDevCodeHint] = useState<string | null>(null);

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
    const validationError = getRegisterValidationMessage({ name, email, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
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
    setRecoverLoading(true);
    setRecoverError(null);
    setRecoverMessage(null);
    setRecoverDevCodeHint(null);

    try {
      const response = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoverEmail }),
      });

      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao solicitar recuperacao.");
      }

      setRecoverMessage(data.message ?? "Codigo enviado.");
      setRecoverDevCodeHint(data.devCode ?? null);
      setForgotStep("reset");
    } catch (requestError) {
      setRecoverError(requestError instanceof Error ? requestError.message : "Falha ao solicitar recuperacao.");
    } finally {
      setRecoverLoading(false);
    }
  }

  async function handleForgotReset() {
    if (recoverNewPassword.length < 8) {
      setRecoverError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (recoverNewPassword !== recoverConfirmPassword) {
      setRecoverError("A confirmacao da nova senha nao confere.");
      return;
    }

    setRecoverLoading(true);
    setRecoverError(null);
    setRecoverMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoverEmail,
          code: recoverCode,
          newPassword: recoverNewPassword,
        }),
      });

      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao redefinir senha.");
      }

      setMessage(data.message ?? "Senha redefinida com sucesso.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setShowForgotFlow(false);
      setForgotStep("request");
      setRecoverCode("");
      setRecoverNewPassword("");
      setRecoverConfirmPassword("");
      setRecoverDevCodeHint(null);
    } catch (resetError) {
      setRecoverError(resetError instanceof Error ? resetError.message : "Falha ao redefinir senha.");
    } finally {
      setRecoverLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6 lg:px-8 dark:bg-zinc-950">
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(20,20,20,0.08)] dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[1.15fr_1fr]">
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

        <div className="p-8 sm:p-10 dark:text-zinc-100">
          <div className="mb-4 flex justify-end">
            <ThemeToggle />
          </div>

          <div className="mb-6 inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setMessage(null);
                setShowForgotFlow(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "login" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700"
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
                setShowForgotFlow(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "register" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Cadastrar
            </button>
          </div>

          <div className="space-y-4">
            {mode === "register" ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              />
            ) : null}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
            />

            {(mode === "login" || mode === "register") ? (
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Senha"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              />
            ) : null}

            {mode === "register" ? (
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirmar senha"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              />
            ) : null}

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            {mode === "login" ? (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>
            ) : null}

            {mode === "register" ? (
              <button
                type="button"
                onClick={handleRegister}
                disabled={isLoading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isLoading ? "Criando conta..." : "Criar conta"}
              </button>
            ) : null}

            {mode === "login" ? (
              <p className="-mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Esqueceu sua senha?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotFlow((current) => !current);
                    setRecoverError(null);
                    setRecoverMessage(null);
                  }}
                  className="font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-300"
                >
                  Recuperar acesso
                </button>
              </p>
            ) : null}

            {mode === "login" && showForgotFlow ? (
              <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                  Recuperacao de senha
                </p>

                {forgotStep === "request" ? (
                  <>
                    <input
                      type="email"
                      value={recoverEmail}
                      onChange={(event) => setRecoverEmail(event.target.value)}
                      placeholder="Email da conta"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={handleForgotRequest}
                      disabled={recoverLoading}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {recoverLoading ? "Enviando..." : "Enviar codigo"}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={recoverCode}
                      onChange={(event) => setRecoverCode(event.target.value.replace(/\D/g, ""))}
                      placeholder="Codigo de 6 digitos"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
                    />
                    <input
                      type="password"
                      value={recoverNewPassword}
                      onChange={(event) => setRecoverNewPassword(event.target.value)}
                      placeholder="Nova senha"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
                    />
                    <input
                      type="password"
                      value={recoverConfirmPassword}
                      onChange={(event) => setRecoverConfirmPassword(event.target.value)}
                      placeholder="Confirmar nova senha"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForgotStep("request")}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Reenviar codigo
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotReset}
                        disabled={recoverLoading}
                        className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {recoverLoading ? "Redefinindo..." : "Redefinir senha"}
                      </button>
                    </div>
                  </>
                )}

                {recoverMessage ? <p className="text-sm text-emerald-700">{recoverMessage}</p> : null}
                {recoverError ? <p className="text-sm text-red-700">{recoverError}</p> : null}
                {recoverDevCodeHint ? (
                  <p className="text-xs text-zinc-500">Ambiente local: codigo {recoverDevCodeHint}</p>
                ) : null}
              </section>
            ) : null}

            <p className="pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Ao continuar, voce concorda com o uso interno da plataforma.
            </p>
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              Precisa de ajuda? <Link href="/" className="font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-300">Acessar ferramenta</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
