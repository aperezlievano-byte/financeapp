// El sobre unico de §5: toda frontera (route handler, server action) lo usa,
// sin excepciones. Los errores nunca se lanzan a traves de una frontera: se
// devuelven.

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "extraction_failed"
  | "internal";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
