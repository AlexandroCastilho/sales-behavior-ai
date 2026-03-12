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
  rawText?: string;
};

type HistorySeedResponse = {
  message?: string;
  detail?: string;
  client?: {
    code?: string;
  };
  clientsLoaded?: number;
  clientCodes?: string[];
  purchasesLoaded?: number;
};

async function readResponseBody<T>(response: Response): Promise<T & { rawText?: string }> {
  const text = await response.text();
  if (!text) {
    return {} as T & { rawText?: string };
  }

  try {
    return JSON.parse(text) as T & { rawText?: string };
  } catch {
    return { rawText: text } as T & { rawText?: string };
  }
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [clientId, setClientId] = useState("client-demo");
  const [fileName, setFileName] = useState("pedido-demo.pdf");
  const [persistResult, setPersistResult] = useState(true);
  const [pdfFile, setPdfFile] = useState<File | undefined>(undefined);
  const [useManualJson, setUseManualJson] = useState(false);
  const [parsedItemsText, setParsedItemsText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [historyPayloadText, setHistoryPayloadText] = useState(
    JSON.stringify(
      {
        client: {
          code: "cliente-real-001",
          name: "Mercado Central Matriz",
          region: "SP",
        },
        products: [
          {
            sku: "CAFE-500",
            name: "Cafe Torrado 500g",
            aliases: ["cafe 500", "cafe tradicional 500g"],
          },
          {
            sku: "ACUCAR-1K",
            name: "Acucar Cristal 1kg",
            aliases: ["acucar 1kg", "acucar cristal 1kg"],
          },
        ],
        purchases: [
          { sku: "CAFE-500", quantity: 22, soldAt: "2026-01-05" },
          { sku: "CAFE-500", quantity: 24, soldAt: "2026-02-09" },
          { sku: "ACUCAR-1K", quantity: 10, soldAt: "2026-01-28" },
        ],
        replaceHistory: true,
      },
      null,
      2,
    ),
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyCsvFile, setHistoryCsvFile] = useState<File | undefined>(undefined);
  const [historyCsvReplace, setHistoryCsvReplace] = useState(true);
  const [historyCsvLoading, setHistoryCsvLoading] = useState(false);
  const [historyCsvStatus, setHistoryCsvStatus] = useState<string | null>(null);
  const [historyCsvError, setHistoryCsvError] = useState<string | null>(null);

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
        const data = await readResponseBody<{ user?: AuthUser | null }>(response);

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
      setPdfFile(undefined);
      return;
    }

    setFileName(file.name);
    setPdfFile(file);
  }

  async function handleSeed() {
    setSeedStatus("Executando seed...");
    setError(null);

    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = await readResponseBody<AnalysisResponse>(response);

      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao executar seed.");
      }

      setSeedStatus("Seed concluido com sucesso. Cliente sugerido: client-demo");
    } catch (seedError) {
      setSeedStatus(null);
      setError(seedError instanceof Error ? seedError.message : "Erro ao executar seed.");
    }
  }

  async function handleLoadHistory() {
    setHistoryLoading(true);
    setHistoryStatus(null);
    setHistoryError(null);

    try {
      const payload = JSON.parse(historyPayloadText) as Record<string, unknown>;
      const response = await fetch("/api/seed/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readResponseBody<HistorySeedResponse>(response);
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Falha ao carregar historico.");
      }

      const clientCode = data.client?.code ? ` Cliente: ${data.client.code}.` : "";
      const purchasesLoaded =
        typeof data.purchasesLoaded === "number" ? ` Compras carregadas: ${data.purchasesLoaded}.` : "";
      setHistoryStatus(`${data.message ?? "Historico carregado com sucesso."}${clientCode}${purchasesLoaded}`);
    } catch (historySeedError) {
      setHistoryError(historySeedError instanceof Error ? historySeedError.message : "Erro ao carregar historico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleHistoryCsvUpload() {
    if (!historyCsvFile) {
      setHistoryCsvError("Selecione um arquivo CSV para carregar.");
      return;
    }

    if (historyCsvFile.size > 20 * 1024 * 1024) {
      setHistoryCsvError("Arquivo CSV muito grande. Limite atual: 20MB.");
      return;
    }

    setHistoryCsvLoading(true);
    setHistoryCsvStatus(null);
    setHistoryCsvError(null);

    try {
      const formData = new FormData();
      formData.append("csvFile", historyCsvFile);
      formData.append("replaceHistory", String(historyCsvReplace));

      const response = await fetch("/api/seed/history/csv", {
        method: "POST",
        body: formData,
      });

      const data = await readResponseBody<HistorySeedResponse>(response);
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Arquivo CSV excede o limite de upload. Tente dividir o arquivo em partes menores.");
        }
        throw new Error(data.detail ?? data.message ?? "Falha ao carregar historico via CSV.");
      }

      const clientCode = data.client?.code
        ? ` Cliente: ${data.client.code}.`
        : data.clientsLoaded
          ? ` Clientes carregados: ${data.clientsLoaded}.`
          : "";
      const clientCodes = Array.isArray(data.clientCodes) && data.clientCodes.length
        ? ` Codigos: ${data.clientCodes.slice(0, 5).join(", ")}${data.clientCodes.length > 5 ? "..." : ""}.`
        : "";
      const purchasesLoaded =
        typeof data.purchasesLoaded === "number" ? ` Compras carregadas: ${data.purchasesLoaded}.` : "";
      setHistoryCsvStatus(
        `${data.message ?? "Historico CSV carregado com sucesso."}${clientCode}${clientCodes}${purchasesLoaded}`,
      );
    } catch (csvError) {
      setHistoryCsvError(csvError instanceof Error ? csvError.message : "Erro ao carregar CSV.");
    } finally {
      setHistoryCsvLoading(false);
    }
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let parsedItems: ParsedItemInput[] | undefined;
      if (!pdfFile && useManualJson && parsedItemsText.trim()) {
        const parsed = JSON.parse(parsedItemsText) as ParsedItemInput[];
        if (!Array.isArray(parsed)) {
          throw new Error("parsedItems deve ser um array JSON.");
        }
        parsedItems = parsed;
      }

      const response = pdfFile
        ? await (async () => {
            const formData = new FormData();
            formData.append("clientId", clientId);
            formData.append("fileName", fileName);
            formData.append("persistResult", String(persistResult));
            formData.append("pdfFile", pdfFile);

            return fetch("/api/analysis", {
              method: "POST",
              body: formData,
            });
          })()
        : await fetch("/api/analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, fileName, persistResult, parsedItems }),
          });

      const data = await readResponseBody<AnalysisResponse>(response);
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("PDF muito grande para envio. Tente um arquivo menor ou use parsedItems em JSON.");
        }

        if (!data.message && !data.detail) {
          const rawSnippet = typeof data.rawText === "string" ? data.rawText.slice(0, 180).replace(/\s+/g, " ").trim() : "";
          throw new Error(
            rawSnippet
              ? `Falha ao processar analise (HTTP ${response.status}). Resposta: ${rawSnippet}`
              : `Falha ao processar analise (HTTP ${response.status}, resposta vazia do servidor).`,
          );
        }

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

          <div className="lg:col-span-2 space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={useManualJson}
                onChange={(event) => setUseManualJson(event.target.checked)}
              />
              Usar entrada manual em JSON (modo avancado)
            </label>

            {useManualJson ? (
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Itens do pedido (JSON)
                <textarea
                  className="min-h-44 rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-900"
                  value={parsedItemsText}
                  onChange={(event) => setParsedItemsText(event.target.value)}
                  placeholder='[{"rawDescription":"Cafe 500g","quantity":10,"confidence":0.9}]'
                />
                <span className="text-xs text-zinc-500">Itens no JSON: {parsedItemsPreview}</span>
                <span className="text-xs text-zinc-500">Se houver PDF enviado, o sistema prioriza o PDF.</span>
              </label>
            ) : (
              <p className="text-xs text-zinc-500">Modo simples ativo: o sistema usa o PDF enviado para extrair os itens automaticamente.</p>
            )}
          </div>

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
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Carga de historico real</h2>
          <p className="mt-3 text-sm text-zinc-600">
            Cole os dados de clientes, produtos e compras para alimentar a base usada na analise dos pedidos.
          </p>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            <p className="font-semibold">Upload CSV (recomendado)</p>
            <p className="mt-1">Cabecalho esperado:</p>
            <p className="mt-1 font-mono">clientCode,clientName,region,sku,productName,aliases,quantity,soldAt</p>
            <p className="mt-1">`aliases` pode usar `|` para multiplos valores. Exemplo: cafe 500|cafe tradicional 500g</p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-700">
              Arquivo CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setHistoryCsvFile(event.target.files?.[0])}
                className="rounded-xl border border-zinc-300 px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:font-semibold"
              />
            </label>

            <label className="inline-flex items-center gap-2 self-end text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={historyCsvReplace}
                onChange={(event) => setHistoryCsvReplace(event.target.checked)}
              />
              Substituir historico existente para os SKUs do arquivo
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleHistoryCsvUpload}
              disabled={historyCsvLoading}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60"
            >
              {historyCsvLoading ? "Importando CSV..." : "Importar CSV no banco"}
            </button>
          </div>

          {historyCsvStatus ? <p className="mt-2 text-sm text-emerald-700">{historyCsvStatus}</p> : null}
          {historyCsvError ? <p className="mt-2 text-sm text-red-700">{historyCsvError}</p> : null}

          <div className="mt-3 space-y-3">
            <textarea
              className="min-h-44 w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-900"
              value={historyPayloadText}
              onChange={(event) => setHistoryPayloadText(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadHistory}
                disabled={historyLoading}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60"
              >
                {historyLoading ? "Carregando historico..." : "Carregar historico no banco"}
              </button>
            </div>

            {historyStatus ? <p className="text-sm text-emerald-700">{historyStatus}</p> : null}
            {historyError ? <p className="text-sm text-red-700">{historyError}</p> : null}
          </div>
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
