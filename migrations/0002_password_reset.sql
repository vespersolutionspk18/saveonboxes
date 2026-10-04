CREATE TABLE IF NOT EXISTS boxsave.password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES boxsave.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON boxsave.password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_expiry_idx ON boxsave.password_reset_tokens(expires_at) WHERE consumed_at IS NULL;
