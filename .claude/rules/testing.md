---
paths:
  - "tests/**"
---

# Reglas: pruebas

- `tests/setup.ts` **se niega a correr contra una base que no termine en `_test`**. No lo desactives.
- `tests/e2e/**` **no importa nada de `src/`**: verifica por la interfaz y consulta la base con
  `docker compose exec -T db psql`.
- `src/server/**` y `src/app/api/**` **no importan `next/*`** — usan `Request`/`Response` web. Eso es
  lo que permite que Vitest los cargue sin bundler. Única excepción: `proxy.ts`, sin tests unitarios.
- Los tests inyectan un cliente de IA falso. La suite unitaria corre sin `ANTHROPIC_API_KEY`.
- **Nunca edites un comando `Verify` para que pase.** Un verify que falla es información, no un
  obstáculo. El protocolo de reanudación lo prohíbe explícitamente.
- **No quites el envoltorio `; test $? -eq N`** de un comando. Esas líneas gatean rutas de error donde
  el éxito *es* un exit distinto de cero. Sin el envoltorio el gate queda rojo para siempre.
- `pnpm fixtures` escribe los fixtures binarios antes de las suites que los necesitan.
- Un test que prueba el *contrato* de una extracción usa cliente falso. La *calidad* de la extracción
  se evalúa a mano contra el modelo real, obligatoriamente, antes de cambiar un prompt o
  `ANTHROPIC_MODEL_ID`.
- **Ningún archivo o valor que un test de integración vaya a confirmar (es decir, que vaya a escribir
  en `transactions`) usa contenido literal fijo.** `source_ref`/dedupe keys son determinísticos por
  diseño: una corrida suelta de `pnpm test tests/integration/<archivo>` dentro de la misma sesión dura
  deja filas confirmadas en la base de test que sobreviven a la siguiente corrida (nada trunca
  `transactions` entre archivos — `fileParallelism: false`), y un valor fijo vuelve a calcular la
  misma clave y choca contra esas filas. Usa `randomUUID()` en cualquier campo que entre al hash.
