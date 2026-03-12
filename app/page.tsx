"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AnalysisResultSection } from "@/components/home/analysis-result-section";
import { AnalysisFormSection } from "@/components/home/analysis-form-section";
import { HistoryImportSection } from "@/components/home/history-import-section";
import { HomeHeader } from "@/components/home/home-header";
import { SessionLoader } from "@/components/home/session-loader";
import { AnalysisResponse } from "@/types/home";

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
    return <SessionLoader />;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-8 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl space-y-6 dark:text-zinc-100">
        <HomeHeader email={authUser?.email} onLogout={handleLogout} />

        <AnalysisFormSection
          clientId={clientId}
          onClientIdChange={setClientId}
          fileName={fileName}
          onFileNameChange={setFileName}
          onPdfFileChange={handleFileChange}
          useManualJson={useManualJson}
          onUseManualJsonChange={setUseManualJson}
          parsedItemsText={parsedItemsText}
          onParsedItemsTextChange={setParsedItemsText}
          persistResult={persistResult}
          onPersistResultChange={setPersistResult}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onSeed={handleSeed}
          seedStatus={seedStatus}
          error={error}
        />

        <HistoryImportSection
          historyCsvReplace={historyCsvReplace}
          onHistoryCsvReplaceChange={setHistoryCsvReplace}
          onHistoryCsvFileChange={setHistoryCsvFile}
          onHistoryCsvUpload={handleHistoryCsvUpload}
          historyCsvLoading={historyCsvLoading}
          historyCsvStatus={historyCsvStatus}
          historyCsvError={historyCsvError}
          historyPayloadText={historyPayloadText}
          onHistoryPayloadTextChange={setHistoryPayloadText}
          onLoadHistory={handleLoadHistory}
          historyLoading={historyLoading}
          historyStatus={historyStatus}
          historyError={historyError}
        />

        <AnalysisResultSection result={result} />

      </section>
    </main>
  );
}
