import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../login/actions";

const NAV_ITEMS = [
  { href: "/", label: "Libro" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/revision", label: "Revisión" },
  { href: "/subir", label: "Subir" },
  { href: "/importar", label: "Importar" },
];

const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main-content"
        className={`sr-only text-sm font-medium text-primary-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 ${FOCUS_RING}`}
      >
        Saltar al contenido
      </a>
      <header className="border-border border-b bg-surface">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <nav
            aria-label="Principal"
            className="flex items-center gap-4 overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 text-sm font-medium text-fg-muted hover:text-fg ${FOCUS_RING}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className={`text-sm font-medium text-fg-muted hover:text-fg ${FOCUS_RING}`}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
