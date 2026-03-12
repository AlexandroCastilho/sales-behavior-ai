import { ChangeEvent, useMemo } from "react";

type AnalysisFormSectionProps = {
  clientId: string;
  onClientIdChange: (value: string) => void;
  fileName: string;
  onFileNameChange: (value: string) => void;
  onPdfFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  useManualJson: boolean;
  onUseManualJsonChange: (value: boolean) => void;
  parsedItemsText: string;
  onParsedItemsTextChange: (value: string) => void;
  persistResult: boolean;
  onPersistResultChange: (value: boolean) => void;
  isLoading: boolean;
  onSubmit: () => void;
  onSeed: () => void;
  seedStatus: string | null;
  error: string | null;
};

type ParsedItemInput = {
  rawDescription: string;
  quantity: number;
  unitPrice?: number;
  confidence?: number;
};

export function AnalysisFormSection(props: AnalysisFormSectionProps) {
  const {
    clientId,
    onClientIdChange,
    fileName,
    onFileNameChange,
    onPdfFileChange,
    useManualJson,
    onUseManualJsonChange,
    parsedItemsText,
    onParsedItemsTextChange,
    persistResult,
    onPersistResultChange,
    isLoading,
    onSubmit,
    onSeed,
    seedStatus,
    error,
  } = props;

  const parsedItemsPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(parsedItemsText) as ParsedItemInput[];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [parsedItemsText]);

  return (
    <section className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 bg-white p-5 lg:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        Cliente (id ou codigo)
        <input
          className="rounded-xl border border-zinc-300 px-3 py-2 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
          value={clientId}
          onChange={(event) => onClientIdChange(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        Nome do arquivo
        <input
          className="rounded-xl border border-zinc-300 px-3 py-2 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
          value={fileName}
          onChange={(event) => onFileNameChange(event.target.value)}
        />
      </label>

      <label className="lg:col-span-2 flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        Upload PDF (opcional)
        <input
          type="file"
          accept="application/pdf"
          onChange={onPdfFileChange}
          className="rounded-xl border border-zinc-300 px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:font-semibold"
        />
      </label>

      <div className="lg:col-span-2 space-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={useManualJson}
            onChange={(event) => onUseManualJsonChange(event.target.checked)}
          />
          Usar entrada manual em JSON (modo avancado)
        </label>

        {useManualJson ? (
          <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            Itens do pedido (JSON)
            <textarea
              className="min-h-44 rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              value={parsedItemsText}
              onChange={(event) => onParsedItemsTextChange(event.target.value)}
              placeholder='[{"rawDescription":"Cafe 500g","quantity":10,"confidence":0.9}]'
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Itens no JSON: {parsedItemsPreview}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Se houver PDF enviado, o sistema prioriza o PDF.
            </span>
          </label>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Modo simples ativo: o sistema usa o PDF enviado para extrair os itens automaticamente.
          </p>
        )}
      </div>

      <label className="lg:col-span-2 inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={persistResult}
          onChange={(event) => onPersistResultChange(event.target.checked)}
        />
        Persistir resultado no banco
      </label>

      <div className="lg:col-span-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isLoading ? "Analisando..." : "Analisar pedido"}
        </button>
        <button
          type="button"
          onClick={onSeed}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Rodar seed demo
        </button>
      </div>

      {seedStatus ? <p className="lg:col-span-2 text-sm text-emerald-700">{seedStatus}</p> : null}
      {error ? <p className="lg:col-span-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
