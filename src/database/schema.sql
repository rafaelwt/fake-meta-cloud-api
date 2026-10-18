-- Table: messages
-- Stores all messages sent through the fake API
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                    -- wamid format ID
    waba_id TEXT NOT NULL,                  -- WhatsApp Business Account ID
    recipient_id TEXT NOT NULL,             -- Phone number without +
    message_type TEXT NOT NULL,             -- 'template', 'text', 'image', 'document', etc.
    message_content TEXT,                   -- JSON stringified content
    status TEXT NOT NULL DEFAULT 'accepted',-- Current status: accepted, sent, delivered, read, failed
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL,            -- Unix timestamp
    error_code INTEGER,                     -- Error code if failed
    error_message TEXT                      -- Error message if failed
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Table: webhook_events
-- Logs all webhook events sent to external systems
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,               -- Foreign key to messages.id
    event_type TEXT NOT NULL,               -- 'sent', 'delivered', 'read', 'failed'
    webhook_url TEXT NOT NULL,              -- URL where webhook was sent
    payload TEXT NOT NULL,                  -- JSON stringified webhook payload
    response_status INTEGER,                -- HTTP response status code
    response_body TEXT,                     -- Response from webhook endpoint
    sent_at INTEGER NOT NULL,               -- Unix timestamp when webhook was sent
    success BOOLEAN NOT NULL DEFAULT 1,     -- Whether webhook delivery succeeded
    error TEXT,                             -- Error message if delivery failed
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_message_id ON webhook_events(message_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_sent_at ON webhook_events(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_success ON webhook_events(success);

-- Table: inbound_messages
-- Stores simulated messages sent by users to the business
CREATE TABLE IF NOT EXISTS inbound_messages (
    id TEXT PRIMARY KEY,                    -- wamid format ID
    waba_id TEXT NOT NULL,                  -- WhatsApp Business Account ID
    from_id TEXT NOT NULL,                  -- Sender phone number without +
    message_type TEXT NOT NULL,             -- 'text'
    message_content TEXT,                   -- JSON stringified content
    received_at INTEGER NOT NULL            -- Unix timestamp
);

-- Index for service window lookups
CREATE INDEX IF NOT EXISTS idx_inbound_messages_from ON inbound_messages(from_id, received_at DESC);

-- Table: message_templates
-- Message templates per WhatsApp Business Account
CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,                    -- Numeric template ID
    waba_id TEXT NOT NULL,                  -- WhatsApp Business Account ID
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    category TEXT NOT NULL,                 -- MARKETING, UTILITY, AUTHENTICATION
    status TEXT NOT NULL,                   -- PENDING, APPROVED, REJECTED
    parameter_format TEXT NOT NULL,         -- POSITIONAL, NAMED
    components TEXT NOT NULL,               -- JSON stringified components
    rejected_reason TEXT,                   -- Set when REJECTED
    message_send_ttl_seconds INTEGER,
    review_at INTEGER,                      -- Unix ms when a PENDING template gets reviewed
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL,            -- Unix timestamp
    UNIQUE (waba_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_waba ON message_templates(waba_id, created_at);

-- Table: uploads
-- Resumable Upload API sessions (file bytes are not stored)
CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,                    -- Session ID without the 'upload:' prefix
    app_id TEXT NOT NULL,
    file_name TEXT,
    file_length INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    file_offset INTEGER NOT NULL DEFAULT 0, -- Bytes received so far
    handle TEXT,                            -- Set once the upload completes
    created_at INTEGER NOT NULL             -- Unix timestamp
);

-- Table: tenants
-- Registered business phone numbers, each with its own token and webhook
CREATE TABLE IF NOT EXISTS tenants (
    phone_number_id TEXT PRIMARY KEY,
    waba_id TEXT NOT NULL,
    display_phone_number TEXT,
    verified_name TEXT,
    quality_rating TEXT,
    access_token TEXT NOT NULL,
    webhook_url TEXT,                       -- NULL: use WEBHOOK_URL
    app_secret TEXT,                        -- NULL: use APP_SECRET
    settings TEXT,                          -- JSON: status_delays, read_probability overrides
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL             -- Unix timestamp
);

CREATE INDEX IF NOT EXISTS idx_tenants_waba ON tenants(waba_id);
