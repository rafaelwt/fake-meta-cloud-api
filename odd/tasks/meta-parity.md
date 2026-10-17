# meta-parity

Objective: close behavior gaps between the fake API and the real WhatsApp Cloud API (v26.0).
Branch: feat/meta-parity (stacked on #2) · Delivery: stacked PRs · Test runner: `pnpm test` (node:test)

## Specs

- S1: Webhooks carry the `X-Hub-Signature-256` header (`sha256=` + HMAC-SHA256 of the raw body with the app secret), like Meta.
- S2: Requests without a valid token return 401 before body validation ("Hoy un request sin token recibe 400").
- S3: Update the docs for S1-S2 ("luego actulizar la doc").
- S4: 24-hour customer service window: free-form messages outside the window fail with 131047.
- S5: Simulate inbound user messages (`messages[]` webhook), which open the window.
- S6: Missing types/endpoints: `interactive`, `reaction`, `location`, `sticker`, `contacts`, mark-as-read, typing indicator.
- S7: `/health` reports the real DB state; validation errors follow Meta's error format (`error_subcode`, `fbtrace_id`).

## Tasks

- [x] T1 · S1 · inline · webhook signature · 37bfbdc
- [x] T2 · S2 · inline · auth before validation · d3331ae
- [x] T3 · S3 · inline · docs for T1-T2 · a086589
- [x] T4 · S4 · inline · service window · d8be021
- [x] T5 · S5 · inline · inbound messages · 073a5db (docs c340d0e)
- [x] T6 · S6 · inline · message types and endpoints · 4d3a57a (docs f0590ad)
- [x] T7 · S7 · inline · health + error format · aff9018 (docs 6fe4fa8)

## Log

- L1 (2026-10-17): "todos papu pero arranquemos con 1 y 2 y luego actulizar la doc" — refers to the gap list 1-6 proposed in the previous turn.
- L2: T1 RED (missing module) → GREEN; sendWebhook signs the exact serialized bytes. E2E receiver validated signatures for sent/delivered/read.
- L3: T2 RED (400 instead of 401) → GREEN by moving auth to onRequest. E2E: no token + bad body → 401; valid → 200.
- L4: T3 docs: README (signature section, APP_SECRET, auth order, structure, API versions), .env.example, docs/json-meta-status.md. Suite 13/13.
- Next: independent verification for T1-T2 (Risk item 2), then T4 service window.
- L5: Independent verifier T1-T2: S1 PASS, S2 PASS, no blockers. Advisory fixed: README isValidSignature threw on multi-byte headers → compare Buffers (8f61d68). Scratch removed.
- L6 (2026-10-17): user chose "Opt-in (Recomendado)" for the service window → SERVICE_WINDOW_ENFORCED=false by default.
- L7: Design T5: POST /:version/:wabaId/simulate/inbound {from, text:{body}, name?} stores in new table inbound_messages and sends a signed messages[] webhook. T4: when enforced, non-template messages to a recipient without inbound in the last 24h get accepted + failed webhook 131047.
- L8: T4/T5 RED (5 failing) → GREEN, suite 20/20. Differential: DB created by old schema boots and gains inbound_messages; window off keeps delivered + ERROR_PATTERNS unchanged.
- L9: T6 RED 9 → GREEN. Also fixed schema branches without required type (missing type reported as template). Mark-as-read on unknown id → 400 code 100.
- L10: T7 RED 5 → GREEN; /ready returned 503 always (fastify.db never decorated) — fixed. Auth errors now Meta codes 2500 (missing) / 190 (invalid). Suite 42/42.
- L11: Feature-end verifier: S4-S7 PASS, S2 re-check PASS. Blocker: sends with an extra `status` key were routed to mark-as-read (400). Fixed: schema `if` matches only status const 'read' (also removes Ajv strict warning). Advisory fixed: /health uses db.open. Regression tests added; suite 44/44. Not done (advisories): error_subcode never set; error flows send `sent` before `failed` (pre-existing); 404 body not in Meta format (pre-existing).
