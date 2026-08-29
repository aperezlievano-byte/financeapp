// El unico lugar que formatea o parsea dinero. Formato es-CO: punto como
// separador de miles, coma decimal. El signo menos es U+2212, no el guion
// ASCII. Los montos son siempre bigint en centavos -- ningun float los toca.

const numberFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const MINUS_SIGN = "−";

export function formatCOP(amountCents: bigint): string {
  const pesos = Number(amountCents) / 100;
  return `$${numberFormatter.format(pesos)}`;
}

export function formatSignedCOP(
  amountCents: bigint,
  direction: "in" | "out",
): string {
  const sign = direction === "out" ? MINUS_SIGN : "+";
  return `${sign}${formatCOP(amountCents)}`;
}

// Espera una cadena de digitos que representa pesos enteros -- nunca coma ni
// punto decimal (§17: el prompt exige amountPesos como cadena de digitos).
export function pesosToCents(pesos: string): bigint {
  if (!/^\d+$/.test(pesos)) {
    throw new Error(
      `pesosToCents: "${pesos}" no es una cadena de dígitos válida.`,
    );
  }
  return BigInt(pesos) * 100n;
}

// Convierte un monto ya numerico (la celda de Excel de import-excel.ts,
// puede traer decimales) a centavos enteros. Redondea antes de convertir a
// bigint para no arrastrar el error de punto flotante de *100 directo.
export function pesosNumberToCents(monto: number): bigint {
  return BigInt(Math.round(Math.abs(monto) * 100));
}
