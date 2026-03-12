type HistoryImportSectionProps = {
  historyCsvReplace: boolean;
  onHistoryCsvReplaceChange: (value: boolean) => void;
  onHistoryCsvFileChange: (file?: File) => void;
  onHistoryCsvUpload: () => void;
  historyCsvLoading: boolean;
  historyCsvStatus: string | null;
  historyCsvError: string | null;
  historyPayloadText: string;
  onHistoryPayloadTextChange: (value: string) => void;
  onLoadHistory: () => void;
  historyLoading: boolean;
  historyStatus: string | null;
  historyError: string | null;
};

export function HistoryImportSection(props: HistoryImportSectionProps) {
  const {
    historyCsvReplace,
    onHistoryCsvReplaceChange,
    onHistoryCsvFileChange,
    onHistoryCsvUpload,
    historyCsvLoading,
    historyCsvStatus,
    historyCsvError,
    historyPayloadText,
    onHistoryPayloadTextChange,
    onLoadHistory,
    historyLoading,
    historyStatus,
    historyError,
  } = props;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Carga de historico real</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Cole os dados de clientes, produtos e compras para alimentar a base usada na analise dos pedidos.
      </p>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
        <p className="font-semibold">Upload CSV ou XLSX (recomendado)</p>
        <p className="mt-1">Para CSV, cabecalho esperado:</p>
        <p className="mt-1 font-mono">clientCode,clientName,region,sku,productName,aliases,quantity,soldAt</p>
        <p className="mt-1">No XLSX do ERP, a 1a linha deve ter os meses e a 2a linha os cabecalhos tecnicos.</p>
        <p className="mt-1">`aliases` pode usar `|` para multiplos valores no CSV. Exemplo: cafe 500|cafe tradicional 500g</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          Arquivo de historico (CSV ou XLSX)
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => onHistoryCsvFileChange(event.target.files?.[0])}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:file:bg-zinc-700 dark:file:text-zinc-100"
          />
        </label>

        <label className="inline-flex items-center gap-2 self-end text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={historyCsvReplace}
            onChange={(event) => onHistoryCsvReplaceChange(event.target.checked)}
          />
          Substituir historico existente para os SKUs do arquivo
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onHistoryCsvUpload}
          disabled={historyCsvLoading}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {historyCsvLoading ? "Importando arquivo..." : "Importar arquivo no banco"}
        </button>
      </div>

      {historyCsvStatus ? <p className="mt-2 text-sm text-emerald-700">{historyCsvStatus}</p> : null}
      {historyCsvError ? <p className="mt-2 text-sm text-red-700">{historyCsvError}</p> : null}

      <div className="mt-3 space-y-3">
        <textarea
          className="min-h-44 w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
          value={historyPayloadText}
          onChange={(event) => onHistoryPayloadTextChange(event.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLoadHistory}
            disabled={historyLoading}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {historyLoading ? "Carregando historico..." : "Carregar historico no banco"}
          </button>
        </div>

        {historyStatus ? <p className="text-sm text-emerald-700">{historyStatus}</p> : null}
        {historyError ? <p className="text-sm text-red-700">{historyError}</p> : null}
      </div>
    </section>
  );
}
