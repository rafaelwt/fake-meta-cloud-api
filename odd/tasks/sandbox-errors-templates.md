# sandbox-errors-templates

Objective: turn the fake into a sandbox where bulk-whatsapp-app can test retries and template validation (blocks A-B of the second request); C-E wait for the user.
Branch: feat/sync-errors-template-validation · Delivery: work-unit commits, push/PR decided by the user · Test runner: `pnpm test` (node:test)

## Specs

- S1 (A): "Errores SÍNCRONOS en POST /messages (respuesta HTTP, no webhook) ... patrones por teléfono que respondan en el momento con formato de error Meta: 429 + code 130429 (throughput) y 400 + code 131056 (pair rate limit); 500 / 503 transitorio, con variante \"falla N veces y después acepta\" (ej. +55555 → 2 fallos y luego 200) para ver retry+backoff; 401 code 190 por token (ya existe); Timeout/respuesta lenta configurable (ej. +44444 tarda X ms)."
- S2 (B): "Validar el template al enviar contra los templates guardados de esa WABA/número: no existe o no está APPROVED para ese nombre+idioma → 404 code 132001; cantidad de parámetros de header/body/botones no coincide con el template → 400 code 132000; header IMAGE/VIDEO/DOCUMENT sin parámetro de media (link o id) → 400 code 132012; named: los parameter_name deben coincidir."
- S3: "Todo con tests y README como lo venís haciendo." "Cuando termines cada bloque, avisame qué cambió en endpoints y .env."
- S4 (C-E, not started): "Si alguna parte de C o D cambia mucho la arquitectura, consultalo con Rafael antes."

## Tasks

- [x] T1 · S1 · inline · SYNC_ERROR_PATTERNS (+ xN fail-then-accept) and RESPONSE_DELAY_PATTERNS · b520cb6
- [x] T2 · S2 · inline · template validation on send (opt-in TEMPLATE_VALIDATION_ENFORCED) · 0204a3b
- [x] T3 · S3 · inline · README, .env.example (in b520cb6, 0204a3b); report to bulk-whatsapp-app

## Log

- L1 (2026-10-18): second request from the bulk-whatsapp-app session (blocks A-E, verbatim A-B above); "Rafael quiere que el fake sea un SANDBOX DEPLOYADO donde se pueda probar todo".
- L2: Decisions: sync errors use a new SYNC_ERROR_PATTERNS env (ERROR_PATTERNS keeps its async webhook meaning); `xN` counters are in memory per pattern+recipient and reset after the accepted attempt, so every retry cycle repeats. Template validation is opt-in (existing clients send arbitrary template names, e.g. tests/inbound.test.js) and resolves the WABA as WABA_ID when the path id is PHONE_NUMBER_ID, otherwise the path id itself.
- L3: T1 RED 6/7 → GREEN; suite 95/95. matchPattern extracted from matchErrorPattern (same matching, ERROR_PATTERNS unchanged).
- L4: T2 RED 8/10 → GREEN; suite 106/106. Named-parameter mismatch answers 132000 (assumption: Meta's exact code for it is not in the request).
