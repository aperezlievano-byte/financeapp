// amountCentsStr: los Server Components pueden pasar props a un Client
// Component solo con tipos serializables por React Flight -- bigint no esta
// en esa lista. El monto viaja como cadena de digitos (igual que
// amountPesos en los formularios) y solo se vuelve a convertir a bigint
// justo antes de llamar a src/lib/money.ts, la unica fuente de verdad para
// formatear dinero.
export type TransactionVM = {
  id: string;
  occurredOn: string;
  description: string;
  amountCentsStr: string;
  direction: "in" | "out";
  accountName: string;
  categoryName: string | null;
};

export type AccountOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };
