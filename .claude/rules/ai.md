---
paths:
  - "src/server/ai/**"
  - "src/server/ingest/extract-*.ts"
---

# Reglas: IA

- `src/server/ai/gateway.ts` es el **ÚNICO** archivo que importa `@anthropic-ai/sdk`. Un `grep` en el
  gate de E1-T5 falla si aparece en otro lado.
- El SDK se importa **de forma perezosa**, dentro de la función, para que la suite unitaria corra sin
  `ANTHROPIC_API_KEY`.
- **El id del modelo NUNCA se escribe en el código.** Va en `ANTHROPIC_MODEL_ID`. El gate falla si
  aparece `claude-`, `sonnet`, `opus` o `haiku` en `src`. Obtén el id invocando la skill `claude-api`
  (se activa sola), nunca de memoria.
- Toda salida del modelo se valida con zod. Si no pasa el esquema: código `extraction_failed` y **no
  se escribe nada**. El sistema **falla cerrado y jamás inventa un movimiento**.
- Un reintento, y solo uno, con espera de 2 s, únicamente ante error de red o `429`. **Nunca** ante
  una respuesta que no pasó el esquema: reintentar un fallo de formato suele repetirlo y duplica el costo.
- Tiempo de espera: 30 s por llamada.
- La confianza (`confidence`) es informativa y **no habilita nada automáticamente**. La revisión
  humana es obligatoria igual.
- `extraction` guarda la salida cruda del gateway para poder auditar una extracción mala.
