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
