import { ThemeToggle } from "@/components/theme-toggle";

type HomeHeaderProps = {
  email?: string;
  onLogout: () => void;
};

export function HomeHeader({ email, onLogout }: HomeHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">Sales Behavior AI</p>
        <h1 className="text-xl font-semibold text-zinc-900">Conferencia de pedido</h1>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
