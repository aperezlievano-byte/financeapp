import { formatSignedCOP } from "../lib/money";

type MoneyCellProps = {
  amountCents: bigint;
  direction: "in" | "out";
};

// El color nunca es el unico indicador de direccion: el prefijo +/- (via
// formatSignedCOP) siempre esta presente. La barra de 3px es el acento no
// textual, y tabular-nums alinea las columnas de dinero verticalmente.
export function MoneyCell({ amountCents, direction }: MoneyCellProps) {
  const accentClass =
    direction === "in" ? "border-l-income" : "border-l-expense";

  return (
    <span
      className={`inline-flex items-center border-l-[3px] pl-2 tabular-nums text-fg ${accentClass}`}
    >
      {formatSignedCOP(amountCents, direction)}
    </span>
  );
}
