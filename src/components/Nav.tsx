import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold text-slate-800">Gamification VCS</span>
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          <Link href="/personas" className="hover:text-slate-900">
            Personas
          </Link>
          <Link href="/splits" className="hover:text-slate-900">
            Splits
          </Link>
        </nav>
      </div>
    </header>
  );
}
