"use client";

import { ChangeEvent, useMemo, useState } from "react";

type ParsedItemInput = {
  rawDescription: string;
  quantity: number;
  unitPrice?: number;
  confidence?: number;
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
  const cards = [
    {
      title: "Produto novo",
      detail: "Detecta item que o cliente nunca comprou.",
      color: "from-orange-200 to-amber-100",
    },
    {
      title: "Pico de quantidade",
      detail: "Aplica regra de 2.5x da media historica.",
      color: "from-rose-200 to-red-100",
    },
    {
      title: "Historico insuficiente",
      detail: "Sinaliza baixa confiabilidade para decisao.",
      color: "from-sky-200 to-cyan-100",
    },
  ] as const;

  const [clientId, setClientId] = useState("client-demo");
  const [fileName, setFileName] = useState("pedido-demo.pdf");
  const [persistResult, setPersistResult] = useState(true);
  const [pdfBase64, setPdfBase64] = useState<string | undefined>(undefined);
  const [parsedItemsText, setParsedItemsText] = useState(
    JSON.stringify(
      [{ rawDescription: "Cafe 500g", quantity: 28, confidence: 0.95 } satisfies ParsedItemInput],
      null,
      2,
    ),
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
        throw new Error(data.message ?? "Falha ao executar seed.");
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
        body: JSON.stringify({
          clientId,
          fileName,
          persistResult,
          pdfBase64,
          parsedItems,
        }),
      });

      const data = (await response.json()) as AnalysisResponse;
      if (!response.ok) {
        throw new Error(data.message ?? "Falha ao processar analise.");
      }

      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao analisar pedido.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#fff8e6,transparent_42%),radial-gradient(circle_at_90%_15%,#ffe6e6,transparent_38%),linear-gradient(180deg,#fffdf8_0%,#fff9f0_100%)] px-6 py-10 sm:px-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-amber-100/70 bg-white/80 p-8 shadow-[0_20px_80px_rgba(111,67,27,0.08)] backdrop-blur md:p-10">
        <div className="flex flex-col gap-4 md:max-w-3xl">
          <p className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-[0.18em] text-amber-900 uppercase">
            Sales Behavior AI
          </p>
          <h1 className="text-4xl leading-tight font-bold text-zinc-900 md:text-5xl">
            Detecte pedidos fora do padrao antes que virem prejuizo.
          </h1>
          <p className="text-base leading-relaxed text-zinc-700 md:text-lg">
            Upload de PDF, comparacao com historico e parecer automatico de risco com regras
            comerciais e IA.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className={`group rounded-2xl border border-zinc-200 bg-gradient-to-br ${card.color} p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1`}
            >
              <h2 className="text-lg font-semibold text-zinc-900">{card.title}</h2>
              <p className="mt-2 text-sm text-zinc-700">{card.detail}</p>
            </article>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 bg-white/95 p-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-700">
            Cliente (id ou codigo)
            <input
              className="rounded-xl border border-zinc-300 px-3 py-2 outline-none ring-0 focus:border-amber-400"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="client-demo"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-700">
            Nome do arquivo
            <input
              className="rounded-xl border border-zinc-300 px-3 py-2 outline-none ring-0 focus:border-amber-400"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="pedido-123.pdf"
            />
          </label>

          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-zinc-700">
            PDF (opcional)
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="rounded-xl border border-zinc-300 px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-200 file:px-3 file:py-1 file:text-sm file:font-semibold"
            />
          </label>

          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-zinc-700">
            parsedItems (JSON opcional)
            <textarea
              className="min-h-44 rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-amber-400"
              value={parsedItemsText}
              onChange={(event) => setParsedItemsText(event.target.value)}
            />
            <span className="text-xs text-zinc-500">Itens no JSON: {parsedItemsPreview}</span>
          </label>

          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={persistResult}
              onChange={(event) => setPersistResult(event.target.checked)}
            />
            Persistir resultado no banco
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={handleSubmit}
            >
              {isLoading ? "Analisando..." : "Analisar pedido"}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
              onClick={handleSeed}
            >
              Rodar seed demo
            </button>
          </div>

          {seedStatus ? <p className="md:col-span-2 text-sm text-emerald-700">{seedStatus}</p> : null}
          {error ? <p className="md:col-span-2 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100">
          <h2 className="text-base font-semibold text-amber-300">Resultado da analise</h2>
          {!result ? (
            <p className="mt-2 text-sm text-zinc-300">Execute uma analise para ver o parecer e os itens avaliados.</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p>
                <strong>Risco geral:</strong> {result.overallRisk ?? "-"}
              </p>
              <p>
                <strong>Parecer IA:</strong> {result.aiSummary ?? "-"}
              </p>
              <div className="space-y-2">
                {result.items?.map((item, index) => (
                  <article key={`${item.item?.rawDescription ?? "item"}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <p>
                      <strong>{item.item?.rawDescription}</strong> | qtd: {item.item?.quantity} | risco: {item.itemRisk}
                    </p>
                    <p className="text-zinc-300">Produto: {item.item?.matchedProductName ?? "Nao identificado"}</p>
                    {item.findings?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-zinc-300">
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
