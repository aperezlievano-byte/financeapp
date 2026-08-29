"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Libro" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/revision", label: "Revisión" },
  { href: "/subir", label: "Subir" },
  { href: "/importar", label: "Importar" },
];

const FOCUS_RING =
  "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 font-medium text-sm transition-colors ${
              active
                ? "bg-highlight text-highlight-fg"
                : "text-fg-muted hover:text-fg"
            } ${FOCUS_RING}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
