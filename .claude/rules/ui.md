---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/lib/money.ts"
---

# Reglas: interfaz

- **Formato de moneda es-CO:** `$1.234.567` — punto como separador de miles, coma decimal. El signo
  menos es **U+2212** (`−`), no el guion ASCII. `src/lib/money.ts` es el único lugar que formatea o
  parsea dinero.
- **Los montos usan `tabular-nums`** para que las columnas alineen verticalmente.
- **El color nunca es el único indicador de dirección.** Toda celda de monto lleva prefijo `+` o `−`.
  Accesibilidad, y además se distingue mejor de un vistazo.
- **El libro es denso tipo hoja de cálculo; la pantalla de revisión es espaciosa.** En el libro se
  escanea, en revisión se decide sobre dinero. No unifiques la densidad.
- Paleta neutral de shadcn/ui + un solo color de acento. Sin gradientes ni adornos.
- Light por default, dark disponible.
- Nada en `src/app/**` importa de la carpeta de otra ruta. Lo compartido va a `src/lib/` o `src/server/`.
- Alias `@/` solo en `src/app/**` y `src/components/**`; el resto con rutas relativas sin extensión.
- Todo control interactivo alcanzable por teclado en orden visual, con indicador de foco visible.
