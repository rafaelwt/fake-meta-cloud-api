# Fake Meta Cloud API

Mock implementation of WhatsApp Business Cloud API for testing and development. Simulates message sending with realistic webhook status updates using EventEmitter and configurable delays.

## Features

- **Full Message Support**: Template, text, image, document, audio, and video messages
- **Async Webhooks**: EventEmitter-based webhook delivery (sent → delivered → read/failed)
- **Realistic Timing**: Configurable delays to simulate real Meta API behavior
- **SQLite Persistence**: Message and webhook event history
- **Error Simulation**: Pattern-based automatic error triggering
- **Strict Validation**: JSON Schema validation matching Meta's API spec
- **Fastify + Pino**: High-performance server with structured logging
- **Versioned API**: any `/vNN.0/` prefix is accepted (docs use `v26.0`)

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

# WhatsApp Business Account IDs
WABA_ID=123456789012345
PHONE_NUMBER_ID=987654321098765
DISPLAY_PHONE_NUMBER=+1234567890

# Delays (milliseconds)
DELAY_SENT_MIN=500
DELAY_SENT_MAX=2000
DELAY_DELIVERED_MIN=3000
DELAY_DELIVERED_MAX=5000
DELAY_READ_MIN=5000
DELAY_READ_MAX=10000

# Behavior
READ_PROBABILITY=0.7  # 70% chance of read status

# Error Patterns (phone:error_code)
ERROR_PATTERNS=+99999:131026,+88888:131047,+77777:131031

# Template pricing categories (template_name:category, trailing * = prefix)
TEMPLATE_CATEGORIES=otp_*:authentication,order_update:utility
TEMPLATE_DEFAULT_CATEGORY=marketing
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

**4. FAILED Status** (if error pattern matches):
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
│   ├── api/
│   │   └── v23/
│   │       └── messages/
│   │           └── index.js          # Message endpoints
│   ├── config/
│   │   ├── index.js                  # Centralized config
│   │   └── errorCodes.js             # Meta error codes
│   ├── database/
│   │   ├── connection.js             # SQLite setup
│   │   ├── messageModel.js           # Message CRUD
│   │   ├── webhookEventModel.js      # Webhook logs
│   │   └── schema.sql                # Database schema
│   ├── middleware/
│   │   └── auth.middleware.js        # Bearer token auth
│   ├── routes/
│   │   └── health.js                 # Health check
│   ├── schemas/
│   │   └── messageRequest.schema.js  # Validation schemas
│   ├── services/
│   │   ├── messageService.js         # Message orchestration
│   │   ├── statusEmitter.js          # EventEmitter (webhooks)
│   │   └── webhookService.js         # HTTP webhook delivery
│   ├── utils/
│   │   ├── delays.js                 # Random delay helpers
│   │   ├── errorPatterns.js          # Pattern matching
│   │   └── idGenerator.js            # wamid generation
│   └── server.js                     # Fastify app
├── docs/
│   ├── json-meta-status.md           # Webhook examples
│   └── send-template.md              # Template examples
├── data/                             # SQLite database (created on run)
├── .env                              # Your config (not in git)
├── .env.example                      # Config template
├── index.js                          # Entry point
├── package.json
└── README.md
```

## Adding New API Versions

To add v24:

1. Create `src/api/v24/messages/index.js`
2. Copy from `src/api/v23/messages/index.js`
3. Modify route path to `/v24.0/:wabaId/messages`
4. Register in `src/server.js`:
   ```js
   app.register(require('./api/v24/messages'), { auth: authMiddleware });
   ```

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
- Include `Authorization: Bearer <token>` header

## License

MIT

## Credits

Built with:
- [Fastify](https://www.fastify.io/) - Fast HTTP server
- [Pino](https://getpino.io/) - Structured logging
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite driver
- [Axios](https://axios-http.com/) - HTTP client

Simulates [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
