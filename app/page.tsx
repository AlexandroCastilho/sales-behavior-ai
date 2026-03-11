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
  ];

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

        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-300">API pronta</p>
            <p className="text-sm text-zinc-300">Envie um POST para /api/analysis com clientId, fileName e pdfBase64.</p>
          </div>
          <a
            href="/api/analysis"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-amber-200"
          >
            Ver endpoint
          </a>
        </div>
      </section>
    </main>
  );
}
