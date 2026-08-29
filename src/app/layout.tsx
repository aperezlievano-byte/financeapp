import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// next/font/google descarga en build time y sirve el archivo propio (self
// hosted) -- sin request a Google en runtime, así que no reintroduce el
// riesgo de build que motivo el "sin webfont" original. Nombres de variable
// distintos de los tokens de Tailwind (--font-sans/--font-display en
// globals.css): asi el fallback del tema nunca depende de que esto cargue.
const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});
const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Personal Finance App",
  description: "Libro de contabilidad personal de un solo usuario.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${bodyFont.variable} ${displayFont.variable}`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
