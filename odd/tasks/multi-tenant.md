# multi-tenant

Objective: several phone numbers / WABAs, each with its own token, webhook URL and app secret, registered in SQLite (block C of the second bulk-whatsapp-app request).
Branch: feat/multi-tenant (stacked on feat/sync-errors-template-validation) · Delivery: work-unit commits, push/PR decided by the user · Test runner: `pnpm test` (node:test)

## Specs

- S1: "Varios números/WABA con su propio token (no un único API_ACCESS_TOKEN ni PHONE_NUMBER_ID global). Ej.: endpoint fake-only para dar de alta un número { phone_number_id, waba_id, display_phone_number, access_token, webhook_url, app_secret } o un archivo seed." User decision: "SQLite registry (Recommended)": tenants table + fake-only endpoints protected by ADMIN_TOKEN to register, list and remove numbers; the current .env stays as the default tenant so nothing breaks.
- S2: "El webhook va a la webhook_url de la app/número correspondiente, firmado con SU app_secret, y metadata.phone_number_id es el número que envió."
- S3: "/simulate/inbound por número."
- S4: "Las rutas validan que el token corresponda a ese phone_number_id/WABA (401/190 si no)."
- S5: "Persistencia que sobreviva reinicios (SQLite está bien, con volumen)."
- S6: tests + README; report endpoint and .env changes to bulk-whatsapp-app.

## Tasks

- [x] T1 · S1, S5 · inline · tenants table/model/service + admin endpoints `/fake/tenants` (ADMIN_TOKEN; disabled when unset)
- [x] T2 · S4 · inline · route-aware auth: phone routes → tenant token; WABA routes → token of any tenant of that WABA; uploads → any known token; unregistered ids keep API_ACCESS_TOKEN · Risk item 2
- [x] T3 · S2, S3 · inline · tenant-aware webhooks (status, inbound, template status): URL, signature secret, metadata, entry id; phone node + template validation use the tenant
- [ ] T4 · S6 · inline · README, .env.example; independent verifier (item 2); report to bulk-whatsapp-app

## Log

- L1 (2026-10-18): block C request (verbatim above) from the bulk-whatsapp-app session; user chose "SQLite registry (Recommended)".
- L2: Design: the default tenant is virtual (built from .env, not stored) and keeps today's output byte for byte for unregistered ids (metadata uses PHONE_NUMBER_ID/DISPLAY_PHONE_NUMBER, webhooks go to WEBHOOK_URL with APP_SECRET). A registered phone_number_id only accepts its own access_token. Admin API answers 403 unless ADMIN_TOKEN is set; responses never echo access_token/app_secret.
- L3: RED 12/14 → GREEN. Found the repo .env (now with sandbox vars) leaking into tests → config skips dotenv under node --test (c2730b4, tests/envIsolation.test.js). Suite 124/124.
- L4: Known gaps (documented): stats/webhooks events not filtered per tenant; service window keyed by sender only (scoping it would change existing single-tenant behavior across path ids).
