# Fake Meta Cloud API

Mock implementation of WhatsApp Business Cloud API for testing and development. Simulates message sending with realistic webhook status updates using EventEmitter and configurable delays.

## Features

- **Full Message Support**: template, text, image, document, audio, video, sticker, interactive, reaction, location and contacts messages, plus replies (`context`)
- **Mark as Read**: mark inbound messages as read, with optional typing indicator
- **Async Webhooks**: EventEmitter-based webhook delivery (sent → delivered → read, or failed only)
- **Realistic Timing**: Configurable delays to simulate real Meta API behavior
- **SQLite Persistence**: Message and webhook event history
- **Error Simulation**: Pattern-based automatic error triggering
- **Strict Validation**: JSON Schema validation matching Meta's API spec
- **Fastify + Pino**: High-performance server with structured logging
- **Versioned API**: any `/vNN.0/` prefix is accepted (docs use `v26.0`)
- **API Reference**: interactive docs at `/docs` (Scalar + OpenAPI 3.1) in development
- **Signed Webhooks**: `X-Hub-Signature-256` header, verifiable with your app secret
- **Inbound Messages**: simulate users writing to the business (`messages[]` webhook)
- **Service Window**: optional 24h customer service window enforcement (error 131047)
- **Phone Number Node**: `GET /:version/:phoneNumberId` returns the verified business profile
- **Message Templates**: list/create templates, approved seeds per WABA, delayed review and `message_template_status_update` webhooks
- **Resumable Upload API**: upload sessions and raw byte uploads that return a file handle (`h`) for template headers

## Architecture

```
Client                    Fake API                   Your System
  │                          │                            │
  │  POST /messages          │                            │
  ├─────────────────────────>│                            │
  │                          │                            │
  │  200 OK (accepted)       │                            │
  │<─────────────────────────┤                            │
  │                          │                            │
  │                          │  [EventEmitter starts]     │
  │                          │  setTimeout(0-2s)          │
  │                          │           │                │
  │                          │  POST /webhook (sent)      │
  │                          ├───────────────────────────>│
  │                          │                            │
  │                          │  setTimeout(3-5s)          │
  │                          │           │                │
  │                          │  POST /webhook (delivered) │
  │                          ├───────────────────────────>│
  │                          │                            │
  │                          │  setTimeout(5-10s)         │
  │                          │           │                │
  │                          │  POST /webhook (read)      │
  │                          ├───────────────────────────>│
```

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env
```

## Configuration

Edit `.env` file:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Webhook URL (where to send status updates)
WEBHOOK_URL=http://localhost:4000/webhook

# Authentication
API_ACCESS_TOKEN=your_fake_bearer_token_here

# App secret used to sign webhooks (X-Hub-Signature-256)
APP_SECRET=your_fake_app_secret_here

# WhatsApp Business Account IDs
WABA_ID=123456789012345
PHONE_NUMBER_ID=987654321098765
DISPLAY_PHONE_NUMBER=+1234567890
VERIFIED_NAME=Fake Business   # returned by GET /:version/:phoneNumberId
QUALITY_RATING=GREEN

# Delays (milliseconds)
DELAY_SENT_MIN=500
DELAY_SENT_MAX=2000
DELAY_DELIVERED_MIN=3000
DELAY_DELIVERED_MAX=5000
DELAY_READ_MIN=5000
DELAY_READ_MAX=10000

# Behavior
READ_PROBABILITY=0.7  # 70% chance of read status
SERVICE_WINDOW_ENFORCED=false  # true: free-form messages need an inbound message in the last 24h

# Error Patterns (phone:error_code)
ERROR_PATTERNS=+99999:131026,+88888:131047,+77777:131031

# Template pricing categories (template_name:category, trailing * = prefix)
TEMPLATE_CATEGORIES=otp_*:authentication,order_update:utility
TEMPLATE_DEFAULT_CATEGORY=marketing

# Message templates API
TEMPLATE_REVIEW_DELAY_MS=5000     # created templates stay PENDING this long
TEMPLATE_REJECT_PREFIX=reject_    # names with this prefix end REJECTED

# Resumable Upload API (max body size of an upload, bytes)
UPLOAD_MAX_BYTES=104857600
```

Status webhooks report per-message pricing (`PMP`): free-form messages are
`free_customer_service` / `service` (not billable); template messages are
`regular` and billable, with the category resolved from `TEMPLATE_CATEGORIES`
(`marketing`, `utility` or `authentication`), falling back to
`TEMPLATE_DEFAULT_CATEGORY`.

## Usage

### Start Server

```bash
# Production mode
pnpm start

# Development mode (with auto-reload)
pnpm dev
```

### API Reference

In development (`NODE_ENV=development`, the default) the server exposes an
interactive reference built from the route schemas:

- `http://localhost:3000/docs/`: Scalar UI, with a named example per message type and a request runner
  and documented responses (success bodies and Meta-format errors)
- `http://localhost:3000/docs/openapi.json`: OpenAPI 3.1 document (also `/docs/openapi.yaml`)

Force it on or off with `DOCS_ENABLED=true|false`. The docs packages are
`devDependencies` and are only loaded when docs are enabled.

### API Endpoints

#### 1. Send Template Message

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+59179021784",
    "type": "template",
    "template": {
      "name": "recordatoriodepagos",
      "language": { "code": "es" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Juan" }
          ]
        }
      ]
    }
  }'
```

**Response (immediate)**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "+59179021784",
    "wa_id": "59179021784"
  }],
  "messages": [{
    "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
    "message_status": "accepted"
  }]
}
```

#### 2. Send Text Message

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+59179021784",
    "type": "text",
    "text": {
      "body": "Hello from Fake API!",
      "preview_url": false
    }
  }'
```

#### 3. Send Image

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+59179021784",
    "type": "image",
    "image": {
      "link": "https://example.com/image.jpg",
      "caption": "Check out this image!"
    }
  }'
```

#### 4. Send Document

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+59179021784",
    "type": "document",
    "document": {
      "link": "https://example.com/document.pdf",
      "filename": "invoice.pdf",
      "caption": "Your invoice"
    }
  }'
```

#### 5. Get Message Statistics

```bash
curl -X GET http://localhost:3000/v26.0/123456789012345/messages/stats \
  -H "Authorization: Bearer your_fake_bearer_token_here"
```

#### 6. Get Webhook Events

```bash
# All recent events
curl -X GET http://localhost:3000/v26.0/123456789012345/webhooks/events \
  -H "Authorization: Bearer your_fake_bearer_token_here"

# Events for specific message
curl -X GET "http://localhost:3000/v26.0/123456789012345/webhooks/events?messageId=wamid.ABC123" \
  -H "Authorization: Bearer your_fake_bearer_token_here"
```

#### 7. Other Message Types

Same endpoint and auth as above; only the body changes:

```jsonc
// Interactive (button, list, cta_url, flow, product, product_list, ...)
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "interactive",
  "interactive": { "type": "button", "body": { "text": "Confirm?" },
    "action": { "buttons": [{ "type": "reply", "reply": { "id": "yes", "title": "Yes" } }] } } }

// Reaction (empty emoji removes it)
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "reaction",
  "reaction": { "message_id": "wamid.ABC", "emoji": "👍" } }

// Location
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "location",
  "location": { "latitude": -16.5, "longitude": -68.15, "name": "La Paz" } }

// Sticker (id or link)
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "sticker",
  "sticker": { "id": "1234567890" } }

// Contacts
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "contacts",
  "contacts": [{ "name": { "formatted_name": "Ana Pérez" }, "phones": [{ "phone": "+59170000000" }] }] }

// Reply to a message: add "context" to any message
{ "messaging_product": "whatsapp", "to": "+59179021784", "type": "text",
  "text": { "body": "Sure!" }, "context": { "message_id": "wamid.ABC" } }
```

#### 8. Mark as Read / Typing Indicator

Marks an inbound message (see Simulate Inbound below) as read. Add
`typing_indicator` to also show "typing…" to the user. Responds
`{ "success": true }`; an unknown `message_id` returns `400` with error code `100`.

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
    "typing_indicator": { "type": "text" }
  }'
```

#### 9. Simulate Inbound Message (fake-only)

Simulates a user writing to the business. Your webhook receives a signed
`messages[]` payload like Meta's, and the user's 24h service window opens.

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/simulate/inbound \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+59179021784",
    "name": "Ana",
    "text": { "body": "Hola!" }
  }'
```

Webhook payload:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789012345",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "+1234567890",
          "phone_number_id": "987654321098765"
        },
        "contacts": [{ "profile": { "name": "Ana" }, "wa_id": "59179021784" }],
        "messages": [{
          "from": "59179021784",
          "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
          "timestamp": "1748718740",
          "type": "text",
          "text": { "body": "Hola!" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

#### 10. Get Phone Number

Any numeric ID returns the configured business profile (`DISPLAY_PHONE_NUMBER`,
`VERIFIED_NAME`, `QUALITY_RATING`). `fields` limits the response; `id` is always
included. A non-numeric ID returns code 100 / subcode 33, like Graph.

```bash
curl "http://localhost:3000/v26.0/987654321098765?fields=display_phone_number,verified_name,quality_rating" \
  -H "Authorization: Bearer your_fake_bearer_token_here"
```

```json
{
  "display_phone_number": "+1234567890",
  "verified_name": "Fake Business",
  "quality_rating": "GREEN",
  "id": "987654321098765"
}
```

#### 11. Message Templates

Every WABA ID starts with these approved templates (seeded on first use):

| Name | Language | Category | Format | Variables |
|------|----------|----------|--------|-----------|
| `hello_world` | `en_US` | UTILITY | POSITIONAL | none (text header + footer) |
| `order_update` | `en_US` | UTILITY | POSITIONAL | body `{{1}}` |
| `promo_image` | `en_US` | MARKETING | POSITIONAL | IMAGE header, body `{{1}}`, URL + quick reply buttons |
| `welcome_named` | `en_US` | MARKETING | NAMED | body `{{first_name}}`, `{{code}}` |

List them (`limit` defaults to 25; `paging.next` is an absolute URL when more remain;
optional filters: `name`, `status`, `category`, `language`):

```bash
curl "http://localhost:3000/v26.0/123456789012345/message_templates?limit=100&fields=id,name,language,category,status,parameter_format,components,rejected_reason" \
  -H "Authorization: Bearer your_fake_bearer_token_here"
```

Create one:

```bash
curl -X POST http://localhost:3000/v26.0/123456789012345/message_templates \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "spring_sale",
    "language": "en_US",
    "category": "MARKETING",
    "parameter_format": "POSITIONAL",
    "components": [
      { "type": "BODY", "text": "Hi {{1}}, our sale starts today!", "example": { "body_text": [["Ana"]] } }
    ]
  }'
```

```json
{ "id": "5839201746381029", "status": "PENDING", "category": "MARKETING" }
```

After `TEMPLATE_REVIEW_DELAY_MS` the template becomes `APPROVED`, or `REJECTED`
with `rejected_reason: "INVALID_FORMAT"` when its name starts with
`TEMPLATE_REJECT_PREFIX` (`reject_`). Either way a signed webhook is sent:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789012345",
    "time": 1748718740,
    "changes": [{
      "field": "message_template_status_update",
      "value": {
        "event": "APPROVED",
        "message_template_id": 5839201746381029,
        "message_template_name": "spring_sale",
        "message_template_language": "en_US",
        "reason": "NONE"
      }
    }]
  }]
}
```

A name + language that already exists in the same WABA returns HTTP 400 with
`code: 100`, `error_subcode: 2388024`.

Sending a template message does not check this list; any template name is accepted.

#### 12. Resumable Upload (template header samples)

```bash
# 1. Start a session (supported types: image/jpeg, image/jpg, image/png, video/mp4, application/pdf)
curl -X POST "http://localhost:3000/v26.0/1234567890/uploads?file_name=header.jpg&file_length=102400&file_type=image/jpeg" \
  -H "Authorization: Bearer your_fake_bearer_token_here"
# {"id":"upload:Q2xh..."}

# 2. Upload the raw bytes (content-type may be omitted or application/octet-stream)
curl -X POST "http://localhost:3000/v26.0/upload:Q2xh..." \
  -H "Authorization: OAuth your_fake_bearer_token_here" \
  -H "file_offset: 0" \
  --data-binary @header.jpg
# {"h":"4::aW1hZ2UvanBlZw==:ARb..."}
```

The handle (`h`) is returned once `file_length` bytes arrived; until then the
response is `{ id, file_offset }`. `GET /v26.0/upload:<id>` returns the current
`file_offset`. File bytes are not stored. Bodies up to `UPLOAD_MAX_BYTES`
(100 MB by default) are accepted.

### Customer Service Window

With `SERVICE_WINDOW_ENFORCED=true`, free-form (non-template) messages are only
delivered if the recipient sent an inbound message in the last 24 hours. Otherwise
the request is still `accepted`, and the status flow ends with a `failed` webhook
carrying error `131047` (Re-engagement message), like Meta. Template messages are
always allowed. Error patterns take precedence over the window check.

### Error Responses

Errors use Meta's Graph API format:

```json
{
  "error": {
    "message": "(#100) Invalid parameter",
    "type": "OAuthException",
    "code": 100,
    "error_data": { "messaging_product": "whatsapp", "details": "body/text must have required property 'body'" },
    "fbtrace_id": "Ab3xYz..."
  }
}
```

| Case | HTTP | `code` | `error_subcode` |
|------|------|--------|-----------------|
| Missing token | 401 | `2500` | — |
| Invalid token | 401 | `190` | `467` |
| Invalid body / unknown `message_id` | 400 | `100` | — (details in `error_data`) |
| Unknown path | 400 | `2500` | — |
| Unexpected server error | 500 | `1` | — |

### Webhook Signature

Every webhook is signed like Meta does: the `X-Hub-Signature-256` header holds
`sha256=` followed by the HMAC-SHA256 of the raw request body, keyed with
`APP_SECRET`. Verify it against the raw body, before parsing JSON:

```js
const crypto = require('crypto');

function isValidSignature(rawBody, header = '', appSecret) {
  const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex'));
  const received = Buffer.from(header);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
```

### Webhook Payloads

After sending a message, your webhook URL will receive POST requests:

**1. SENT Status** (0.5-2 seconds later):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789012345",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "+1234567890",
          "phone_number_id": "987654321098765"
        },
        "statuses": [{
          "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
          "status": "sent",
          "timestamp": "1748718745",
          "recipient_id": "59179021784",
          "pricing": {
            "billable": false,
            "pricing_model": "PMP",
            "type": "free_customer_service",
            "category": "service"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**2. DELIVERED Status** (3-5 seconds later):
```json
{
  ...
  "statuses": [{
    "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
    "status": "delivered",
    "timestamp": "1748718750",
    "recipient_id": "59179021784",
    "pricing": { ... }
  }]
}
```

**3. READ Status** (5-10 seconds later, 70% probability):
```json
{
  ...
  "statuses": [{
    "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
    "status": "read",
    "timestamp": "1748718755",
    "recipient_id": "59179021784"
  }]
}
```

**4. FAILED Status** (0.5-2 seconds later, if an error pattern matches or the service window is closed). Like Meta, a failed message gets only this status, without a previous `sent`:
```json
{
  ...
  "statuses": [{
    "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI...",
    "status": "failed",
    "timestamp": "1748718760",
    "recipient_id": "59179021784",
    "errors": [{
      "code": 131026,
      "title": "Message undeliverable",
      "message": "Message is undeliverable due to phone number being invalid or blocked",
      "error_data": {
        "details": "The phone number is not a valid WhatsApp number..."
      }
    }]
  }]
}
```

## Error Simulation

Configure error patterns in `.env`:

```bash
ERROR_PATTERNS=+99999:131026,+88888:131047,+77777:131031
```

**Available Error Codes:**

| Code   | Description                            | Trigger Number |
|--------|----------------------------------------|----------------|
| 131047 | Re-engagement message (24h window)     | +88888...      |
| 131045 | Spam rate limit hit                    | (manual)       |
| 131026 | Message undeliverable (invalid number) | +99999...      |
| 131031 | Recipient phone not available          | +77777...      |
| 131051 | Unsupported message type               | (manual)       |
| 133016 | User in experiment                     | (manual)       |

**Testing Errors:**

```bash
# This will fail with error 131026
curl -X POST http://localhost:3000/v26.0/123456789012345/messages \
  -H "Authorization: Bearer your_fake_bearer_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+99999123456",  # ← Matches error pattern
    "type": "text",
    "text": { "body": "This will fail" }
  }'
```

## Project Structure

```
fake-meta-cloud-api/
├── src/
│   ├── config/
│   │   ├── index.js                  # Centralized config
│   │   └── errorCodes.js             # Meta error codes
│   ├── controllers/
│   │   ├── messagesController.js     # Message route handlers
│   │   └── graphController.js        # Phone number, templates, uploads
│   ├── database/
│   │   ├── connection.js             # SQLite setup
│   │   ├── models.js                 # Model instances
│   │   ├── messageModel.js           # Message CRUD
│   │   ├── inboundMessageModel.js    # Simulated user messages
│   │   ├── webhookEventModel.js      # Webhook logs
│   │   ├── templateModel.js          # Message templates
│   │   ├── templateSeeds.js          # Approved seed templates
│   │   ├── uploadModel.js            # Upload sessions
│   │   └── schema.sql                # Database schema
│   ├── events/
│   │   ├── bus.js                    # EventEmitter bus
│   │   ├── emitter.js                # Status flow + webhook payloads
│   │   └── listeners/                # sent/delivered/read/failed handlers
│   ├── middleware/
│   │   └── auth.middleware.js        # Bearer/OAuth token auth (onRequest)
│   ├── routes/
│   │   ├── health.js                 # Health check
│   │   ├── messages.routes.js        # Versioned message endpoints
│   │   └── graph.routes.js           # Phone number, templates, uploads
│   ├── schemas/
│   │   ├── messageRequest.schema.js  # Validation schemas
│   │   ├── inboundRequest.schema.js  # Simulated inbound schema
│   │   └── templateRequest.schema.js # Template creation schema
│   ├── services/
│   │   ├── messageService.js         # Message orchestration + service window
│   │   ├── inboundService.js         # Simulated inbound messages
│   │   ├── webhookService.js         # Signed HTTP webhook delivery
│   │   ├── phoneNumberService.js     # Phone number node
│   │   ├── templateService.js        # Templates, seeds, review lifecycle
│   │   └── uploadService.js          # Resumable Upload API
│   ├── utils/
│   │   ├── delays.js                 # Random delay helpers
│   │   ├── errorPatterns.js          # Pattern matching
│   │   ├── fields.js                 # Graph `fields` parameter
│   │   ├── idGenerator.js            # wamid generation
│   │   ├── signature.js              # X-Hub-Signature-256
│   │   └── templateCategories.js     # Template pricing categories
│   ├── logger.js                     # Pino logger
│   └── server.js                     # Fastify app
├── tests/                            # node:test suites
├── docs/
│   ├── json-meta-status.md           # Webhook examples
│   └── send-teamplate.md             # Template examples
├── data/                             # SQLite database (created on run)
├── .env                              # Your config (not in git)
├── .env.example                      # Config template
├── index.js                          # Entry point
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## API Versions

Routes accept any `vNN.N` prefix (`/v19.0/...`, `/v26.0/...`), so clients can
keep their configured Graph API version. Unknown prefixes or paths return
`400` with code `2500` (`Unknown path components`), like Graph API.

## Development

### Database

SQLite database is created automatically in `./data/fake-meta-api.db`.

**Tables:**
- `messages`: All sent messages with status
- `webhook_events`: All webhook deliveries (success/failure)

**Inspect Database:**
```bash
sqlite3 ./data/fake-meta-api.db
sqlite> SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;
sqlite> SELECT * FROM webhook_events ORDER BY sent_at DESC LIMIT 5;
```

### Logging

Pino logger with pretty printing in development:

```bash
# Set log level
LOG_LEVEL=debug pnpm dev

# Disable pretty printing
LOG_PRETTY=false pnpm start
```

Log files (`combined.log`, `info.log`, `error.log`) go to `./logs` by default.
Set `LOG_DIR` to write them elsewhere (e.g. a Docker volume). Test runs
(`pnpm test`) write to a temp directory instead, so they never mix with the
server logs.

### Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch
```

## Troubleshooting

### Webhooks not arriving

1. Check webhook URL is correct: `echo $WEBHOOK_URL`
2. Make sure your webhook server is running
3. Check webhook logs:
   ```bash
   curl http://localhost:3000/v26.0/123456789012345/webhooks/events \
     -H "Authorization: Bearer your_token"
   ```

### Messages stuck in "accepted"

- Check server logs for errors
- Verify EventEmitter is working (not crashing)
- Check database for status updates

### Authentication errors

- Verify Bearer token matches `.env` `API_ACCESS_TOKEN`
- Include `Authorization: Bearer <token>` header (`Authorization: OAuth <token>`
  is accepted too, as in the Graph API)
- Authentication runs before body validation: a missing or wrong token always
  returns `401` (codes `2500` / `190`), even if the body is invalid

### Webhook signature mismatch

- `APP_SECRET` must match the app secret your webhook handler uses
- Compute the HMAC over the raw body bytes, not over re-serialized JSON

## License

MIT

## Credits

Built with:
- [Fastify](https://www.fastify.io/) - Fast HTTP server
- [Pino](https://getpino.io/) - Structured logging
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite driver
- [Axios](https://axios-http.com/) - HTTP client

Simulates [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
