# graph-templates-uploads

Objective: add the Graph API calls the bulk-whatsapp-app backend makes besides sending messages (phone number lookup, message templates, resumable upload).
Branch: feat/graph-templates-uploads · Delivery: work-unit commits, push/PR decided by the user · Test runner: `pnpm test` (node:test)

## Specs

- S1: "GET /{v}/{phoneNumberId} — al registrar un número. Basta con 200 + `{ id, display_phone_number, verified_name, quality_rating }`; sin display_phone_number ni verified_name lo damos por no verificado. Token inválido → error Meta 190 (lo mapeamos)."
- S2: "GET /{v}/{wabaId}/message_templates?limit=100&fields=id,name,language,category,status,parameter_format,components,rejected_reason → `{ data: [...], paging?: { next?: \"<url absoluta>\" } }`. Cada template: { id, name, language, category: \"MARKETING\"|\"UTILITY\"|\"AUTHENTICATION\", status: \"APPROVED\"|\"PENDING\"|\"REJECTED\", parameter_format: \"POSITIONAL\"|\"NAMED\", components: [...] (formato Graph: HEADER/BODY/FOOTER/BUTTONS con example), rejected_reason? }. Necesita unos templates semilla aprobados (ej. uno sin variables, uno con body {{1}}, uno con header IMAGE) para poder lanzar campañas."
- S3: "POST /{v}/{wabaId}/message_templates — body JSON `{ name, language, category, parameter_format, components, message_send_ttl_seconds? }` → `{ id, status: \"PENDING\", category }`. Debe quedar persistido y aparecer en el GET (punto 2). Ideal: pasa a APPROVED solo después de N segundos (configurable), y una regla para forzar REJECTED con rejected_reason (ej. nombre con prefijo `reject_`). Nombre+idioma duplicado en la misma WABA → 400 `{ error: { code: 100, error_subcode: 2388024, message, type: \"OAuthException\" } }` (lo mapeamos a 409). Si después podés emitir el webhook `message_template_status_update`, mejor, pero no es obligatorio."
- S4: "Resumable Upload (encabezados imagen/video/documento): a) POST /{v}/{appId}/uploads?file_name=…&file_length=…&file_type=… (Bearer) → `{ id: \"upload:<algo>\" }`. b) POST /{v}/upload:<algo> con headers `Authorization: OAuth <token>` (OJO: esquema OAuth, no Bearer; el auth middleware hoy solo acepta Bearer) y `file_offset: 0`, body = bytes crudos (content-type puede venir vacío u octet-stream; hasta ~16 MB, subí el bodyLimit de Fastify) → `{ h: \"<handle>\" }`. Ojo con el `:` dentro del segmento de ruta en Fastify."
- S5: "Con tests y README como ya tenés en el repo." Report back: endpoints, configuration, seed templates (name, language, variables), `.env` values.

## Tasks

- [ ] T1 · S4 (auth part) · inline · accept `OAuth <token>` besides `Bearer <token>` · Risk item 2 · user approved ("si")
- [x] T2 · S1 · inline · GET phone number node · 3aabae5
- [x] T3 · S2-S3 · inline · templates table, seeds, list/create, review lifecycle + webhook · 3aabae5
- [x] T4 · S4 · inline · resumable upload session + raw body upload (Bearer only until T1) · 3aabae5
- [~] T5 · S5 · inline · README, .env.example, banner/root endpoints · cb28ed9 · independent verifier pending until T1 is decided

## Log

- L1 (2026-10-17): request from the bulk-whatsapp-app session on the user's behalf (verbatim specs above): "El usuario (Rafael) aprobó usar este fake como Meta de pruebas y pidió que vos lo prepares."
- L2: Probes: find-my-way routes `/v26.0/upload:abc` into a `/:version/:target` param (colon kept); a `*` buffer parser handles a missing content-type, but an explicit empty `content-type:` header gets 415 unless stripped first. RDD is globally off.
- L3: Decisions: phone number lookup answers any numeric id (non-numeric → code 100 subcode 33, like Graph); seeds are inserted lazily per WABA so any WABA_ID works; review delay TEMPLATE_REVIEW_DELAY_MS, reject prefix TEMPLATE_REJECT_PREFIX; status resolves on read too, so a restart never leaves templates PENDING.
- L4: RED 21/22 (only the unknown-node POST passed) → GREEN 22/22; suite 82/82 (docs test path list updated intentionally). T2-T4 share route/controller/server wiring, so they landed in one feat commit (3aabae5, ~1.1k lines incl. tests) instead of three slices.
- L5: Smoke on a real server (scratch DB, port 3999, NODE_ENV=production): phone fields, templates paging with absolute next, upload with empty Content-Type → `{h}`. Scratch removed.
- L6: Behavior change: single-segment unknown paths (`GET /v26.0/foo`) now resolve as Graph nodes (401 without token, 400 code 100/33 with token) instead of 2500; `POST /v26.0/<id>` keeps 2500 but checks the token first. Risk: item 3 (shared routing).
- Next: user decision on T1 (OAuth scheme), then independent verifier for the feature, push/PR on the user's call.
- L7 (2026-10-17): user approved the OAuth scheme: "si". RED 2/5 (valid OAuth token, OAuth upload) → GREEN; suite 87/87.
