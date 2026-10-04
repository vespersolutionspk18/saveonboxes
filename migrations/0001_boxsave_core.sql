CREATE SCHEMA IF NOT EXISTS boxsave;

CREATE TABLE IF NOT EXISTS boxsave.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'super_admin')),
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boxsave.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES boxsave.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_active_idx ON boxsave.sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS boxsave.label_batches (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES boxsave.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boxsave.labels (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES boxsave.label_batches(id) ON DELETE RESTRICT,
  serial text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  token_ciphertext text NOT NULL,
  token_key_version integer NOT NULL DEFAULT 1,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS labels_batch_idx ON boxsave.labels(batch_id, serial);
CREATE INDEX IF NOT EXISTS labels_available_idx ON boxsave.labels(created_at) WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS boxsave.rooms (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES boxsave.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS boxsave.customer_counters (
  owner_id uuid PRIMARY KEY REFERENCES boxsave.users(id) ON DELETE RESTRICT,
  next_box_number integer NOT NULL DEFAULT 1 CHECK (next_box_number > 0)
);

CREATE TABLE IF NOT EXISTS boxsave.boxes (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES boxsave.users(id) ON DELETE RESTRICT,
  label_id uuid UNIQUE REFERENCES boxsave.labels(id) ON DELETE RESTRICT,
  box_number integer NOT NULL CHECK (box_number > 0),
  name text,
  room_id uuid REFERENCES boxsave.rooms(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'packing' CHECK (status IN ('packing', 'packed', 'unpacked')),
  notes text,
  fragile boolean NOT NULL DEFAULT false,
  open_early boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, box_number)
);
CREATE INDEX IF NOT EXISTS boxes_owner_active_idx ON boxsave.boxes(owner_id, archived_at, box_number);
CREATE INDEX IF NOT EXISTS boxes_room_idx ON boxsave.boxes(room_id, owner_id);
CREATE INDEX IF NOT EXISTS boxes_label_idx ON boxsave.boxes(label_id) WHERE label_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS boxsave.box_items (
  id uuid PRIMARY KEY,
  box_id uuid NOT NULL REFERENCES boxsave.boxes(id) ON DELETE RESTRICT,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS box_items_box_idx ON boxsave.box_items(box_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS box_items_search_idx ON boxsave.box_items USING gin (to_tsvector('simple', name || ' ' || coalesce(notes, '')));

CREATE TABLE IF NOT EXISTS boxsave.scan_events (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE,
  label_id uuid REFERENCES boxsave.labels(id) ON DELETE SET NULL,
  token_hash text NOT NULL,
  actor_user_id uuid REFERENCES boxsave.users(id) ON DELETE SET NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('url_open', 'camera_scan', 'claim_created', 'claim_existing', 'claim_conflict', 'invalid', 'manufacturing_preview')),
  source text NOT NULL CHECK (source IN ('url', 'camera', 'admin_preview', 'api')),
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scan_events_label_time_idx ON boxsave.scan_events(label_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_events_time_kind_idx ON boxsave.scan_events(created_at DESC, event_kind);
CREATE INDEX IF NOT EXISTS scan_events_actor_idx ON boxsave.scan_events(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS boxsave.admin_audit_events (
  id uuid PRIMARY KEY,
  actor_admin_id uuid REFERENCES boxsave.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON boxsave.admin_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON boxsave.admin_audit_events(target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS boxsave.rate_limit_buckets (
  key_hash text PRIMARY KEY,
  hits integer NOT NULL,
  window_started_at timestamptz NOT NULL,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boxsave.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
