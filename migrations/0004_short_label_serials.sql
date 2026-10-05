CREATE TABLE IF NOT EXISTS boxsave.label_serial_allocator (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton IS TRUE),
  next_value bigint NOT NULL DEFAULT 0 CHECK (next_value BETWEEN 0 AND 1679616)
);
INSERT INTO boxsave.label_serial_allocator(singleton, next_value)
VALUES (true, 0)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE boxsave.labels
  ADD COLUMN IF NOT EXISTS short_serial text;

DO $short_serial_backfill$
DECLARE
  existing_count bigint;
BEGIN
  SELECT count(*) INTO existing_count FROM boxsave.labels;
  IF existing_count > 1679616 THEN
    RAISE EXCEPTION 'Cannot backfill short label serials: the 36^4 namespace is exhausted';
  END IF;

  WITH ranked AS (
    SELECT id, ((row_number() OVER (ORDER BY created_at, id) - 1 + 466560) % 1679616) AS serial_value
    FROM boxsave.labels
  ), encoded AS (
    SELECT id,
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((serial_value / 46656) % 36)::integer + 1, 1) ||
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((serial_value / 1296) % 36)::integer + 1, 1) ||
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((serial_value / 36) % 36)::integer + 1, 1) ||
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (serial_value % 36)::integer + 1, 1) AS short_serial
    FROM ranked
  )
  UPDATE boxsave.labels l
  SET short_serial = encoded.short_serial
  FROM encoded
  WHERE encoded.id = l.id;

  UPDATE boxsave.label_serial_allocator
  SET next_value = GREATEST(next_value, existing_count)
  WHERE singleton IS TRUE;

  UPDATE boxsave.boxes b
  SET name = l.short_serial, updated_at = now()
  FROM boxsave.labels l
  WHERE b.label_id = l.id
    AND (b.name IS NULL OR btrim(b.name) = '' OR b.name = 'Box ' || b.box_number::text);
END
$short_serial_backfill$;

ALTER TABLE boxsave.labels
  ALTER COLUMN short_serial SET NOT NULL;

DO $short_serial_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boxsave.labels'::regclass AND conname = 'labels_short_serial_format_check'
  ) THEN
    ALTER TABLE boxsave.labels
      ADD CONSTRAINT labels_short_serial_format_check CHECK (short_serial ~ '^[0-9A-Z]{4}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boxsave.labels'::regclass AND conname = 'labels_short_serial_unique'
  ) THEN
    ALTER TABLE boxsave.labels
      ADD CONSTRAINT labels_short_serial_unique UNIQUE (short_serial);
  END IF;
END
$short_serial_constraints$;
