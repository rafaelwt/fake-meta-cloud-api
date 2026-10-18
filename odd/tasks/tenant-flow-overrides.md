# tenant-flow-overrides

Objective: block E of the second bulk-whatsapp-app request (optional): per-number status delays / read probability and a fake-only forced status endpoint.
Branch: feat/tenant-flow-overrides (stacked on feat/multi-tenant) · Delivery: work-unit commits, push/PR decided by the user · Test runner: `pnpm test` (node:test)

## Specs

- S1: "Opcional: delays de status y READ_PROBABILITY configurables por número"
- S2: "y un endpoint fake-only para forzar el status de un wamid (ej. marcar read ya)."

## Tasks

- [x] T1 · S1 · inline · tenant `status_delays` / `read_probability` (tenants.settings JSON + startup migration)
- [x] T2 · S2 · inline · `POST /:version/:phoneNumberId/simulate/status` (phone token, cancels pending flow)

## Log

- L1 (2026-10-18): block E request (verbatim above).
- L2: RED 6/6 (feature missing) → GREEN; bugs found while going green: message_content is already parsed by findById; additionalProperties:false strips unknown keys under Fastify's removeAdditional, so status_delays uses propertyNames to reject them. Suite 139/139.
- L3: Feature-end verifier (D + E): E PASS (forced status cancels only its message, close cancels all, migration from a8bceba OK); D PASS on Docker (healthy, persistence, non-root, no .env in image), reset scoping and rollback. Blocker: /fake/reset during a pending flow crashed the server (FK error inside sendWebhook's catch → unhandledRejection → exit 1). Fixed: reset cancels the pending flows of the deleted messages; reset of an unowned WABA ID also clears messages sent from it (advisory). Regression tests added; suite 141/141. Scratch removed.
- L4 (2026-10-18): request from bulk-whatsapp-app: "que messages/stats y webhooks/events filtren por el token/número que consulta"; user: "si dale". RED 1/1 → GREEN: both endpoints filter by the path phone number (messages.waba_id); events of another number's message return an empty list. Suite 142/142.
