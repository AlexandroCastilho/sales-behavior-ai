"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ParsedItemInput = {
  rawDescription: string;
  quantity: number;
  unitPrice?: number;
  confidence?: number;
};

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

type AnalysisResponse = {
  overallRisk?: string;
  aiSummary?: string;
  items?: Array<{
    itemRisk?: string;
    item?: {
      rawDescription?: string;
      quantity?: number;
      matchedProductName?: string;
    };
    findings?: Array<{ message?: string }>;
  }>;
  message?: string;
  detail?: string;
};

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [clientId, setClientId] = useState("client-demo");
  const [fileName, setFileName] = useState("pedido-demo.pdf");
  const [persistResult, setPersistResult] = useState(true);
  const [pdfBase64, setPdfBase64] = useState<string | undefined>(undefined);
  const [parsedItemsText, setParsedItemsText] = useState(
    JSON.stringify([{ rawDescription: "Cafe 500g", quantity: 28, confidence: 0.95 }], null, 2),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  const parsedItemsPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(parsedItemsText) as ParsedItemInput[];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [parsedItemsText]);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me");
        const data = (await response.json()) as { user?: AuthUser | null };

        if (!data.user) {
          router.replace("/login");
          return;
        }

        setAuthUser(data.user);
      } catch {
        router.replace("/login");
      } finally {
        setCheckingSession(false);
      }
    }

    loadSession();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPdfBase64(undefined);
      return;
    }

    setFileName(file.name);
    const encoded = await toBase64(file);
    setPdfBase64(encoded);
  }

  async function handleSeed() {
    setSeedStatus("Executando seed...");
    setError(null);

    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = (await response.json()) as AnalysisResponse;

      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao executar seed.");
      }

      setSeedStatus("Seed concluido com sucesso. Cliente sugerido: client-demo");
    } catch (seedError) {
      setSeedStatus(null);
      setError(seedError instanceof Error ? seedError.message : "Erro ao executar seed.");
    }
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let parsedItems: ParsedItemInput[] | undefined;
      if (parsedItemsText.trim()) {
        const parsed = JSON.parse(parsedItemsText) as ParsedItemInput[];
        if (!Array.isArray(parsed)) {
          throw new Error("parsedItems deve ser um array JSON.");
        }
        parsedItems = parsed;
      }

      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, fileName, persistResult, pdfBase64, parsedItems }),
      });

      const data = (await response.json()) as AnalysisResponse;
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao processar analise.");
      }

      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao analisar pedido.");
    } finally {
      setIsLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100">
        <p className="text-sm text-zinc-600">Carregando ambiente...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-8">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">Sales Behavior AI</p>
            <h1 className="text-xl font-semibold text-zinc-900">Conferencia de pedido</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-zinc-600">{authUser?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              Sair
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 bg-white p-5 lg:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-700">
            Cliente (id ou codigo)
            <input
              className="rounded-xl border border-zinc-300 px-3 py-2 outline-none transition focus:border-zinc-900"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-700">
            Nome do arquivo
            <input
              className="rounded-xl border border-zinc-300 px-3 py-2 outline-none transition focus:border-zinc-900"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
            />
          </label>

          <label className="lg:col-span-2 flex flex-col gap-2 text-sm text-zinc-700">
            Upload PDF (opcional)
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="rounded-xl border border-zinc-300 px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:font-semibold"
            />
          </label>

          <label className="lg:col-span-2 flex flex-col gap-2 text-sm text-zinc-700">
            Itens do pedido (JSON opcional)
            <textarea
              className="min-h-44 rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-900"
              value={parsedItemsText}
              onChange={(event) => setParsedItemsText(event.target.value)}
            />
            <span className="text-xs text-zinc-500">Itens no JSON: {parsedItemsPreview}</span>
          </label>

          <label className="lg:col-span-2 inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={persistResult}
              onChange={(event) => setPersistResult(event.target.checked)}
            />
            Persistir resultado no banco
          </label>

          <div className="lg:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {isLoading ? "Analisando..." : "Analisar pedido"}
            </button>
            <button
              type="button"
              onClick={handleSeed}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            >
              Rodar seed demo
            </button>
          </div>

          {seedStatus ? <p className="lg:col-span-2 text-sm text-emerald-700">{seedStatus}</p> : null}
          {error ? <p className="lg:col-span-2 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Resultado</h2>
          {!result ? (
            <p className="mt-3 text-sm text-zinc-600">Execute uma analise para visualizar o parecer.</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-zinc-800">
              <p>
                <strong>Risco geral:</strong> {result.overallRisk ?? "-"}
              </p>
              <p>
                <strong>Parecer IA:</strong> {result.aiSummary ?? "-"}
              </p>
              <div className="space-y-2">
                {result.items?.map((item, index) => (
                  <article key={`${item.item?.rawDescription ?? "item"}-${index}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p>
                      <strong>{item.item?.rawDescription}</strong> | qtd: {item.item?.quantity} | risco: {item.itemRisk}
                    </p>
                    <p className="text-zinc-600">Produto: {item.item?.matchedProductName ?? "Nao identificado"}</p>
                    {item.findings?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-zinc-700">
                        {item.findings.map((finding, findingIndex) => (
                          <li key={`${finding.message ?? "finding"}-${findingIndex}`}>{finding.message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
