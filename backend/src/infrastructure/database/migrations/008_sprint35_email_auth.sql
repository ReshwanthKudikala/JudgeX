-- Sprint 35 — Email verification & password recovery (additive).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

-- One table for verification + password-reset tokens (hashed at rest).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  purpose VARCHAR(32) NOT NULL
    CHECK (purpose IN ('email_verification', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_auth_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
  ON auth_tokens (user_id, purpose)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires
  ON auth_tokens (expires_at)
  WHERE used_at IS NULL;
