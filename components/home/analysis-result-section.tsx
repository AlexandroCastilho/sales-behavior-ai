import { AnalysisResponse } from "@/types/home";

type AnalysisResultSectionProps = {
  result: AnalysisResponse | null;
};

export function AnalysisResultSection({ result }: AnalysisResultSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Resultado</h2>
      {!result ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Execute uma analise para visualizar o parecer.</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-zinc-800">
          <p>
            <strong>Risco geral:</strong> {result.overallRisk ?? "-"}
          </p>
          <p>
            <strong>Parecer IA:</strong> {result.aiSummary ?? "-"}
          </p>

          <div className="space-y-2">
            <p className="font-semibold">Itens</p>
            {(result.items ?? []).map((item, index) => (
              <article key={`${item.item?.rawDescription ?? "item"}-${index}`} className="rounded-xl border border-zinc-200 p-3">
                <p>
                  <strong>Descricao:</strong> {item.item?.rawDescription ?? "-"}
                </p>
                <p>
                  <strong>Quantidade:</strong> {item.item?.quantity ?? "-"}
                </p>
                <p>
                  <strong>Produto sugerido:</strong> {item.item?.matchedProductName ?? "-"}
                </p>
                <p>
                  <strong>Risco do item:</strong> {item.itemRisk ?? "-"}
                </p>
                {(item.findings ?? []).length ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-300">
                    {(item.findings ?? []).map((finding, findingIndex) => (
                      <li key={`${finding.message ?? "finding"}-${findingIndex}`}>{finding.message ?? "Achado sem detalhe."}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
