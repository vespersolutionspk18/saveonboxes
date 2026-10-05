ALTER TABLE boxsave.boxes
  ADD COLUMN IF NOT EXISTS origin_room_id uuid REFERENCES boxsave.rooms(id) ON DELETE SET NULL;

UPDATE boxsave.boxes
SET name = 'Box ' || box_number::text
WHERE name IS NULL OR btrim(name) = '';

CREATE INDEX IF NOT EXISTS boxes_origin_room_idx
  ON boxsave.boxes(origin_room_id, owner_id)
  WHERE origin_room_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS boxsave.item_images (
  item_id uuid PRIMARY KEY REFERENCES boxsave.box_items(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'image/webp' CHECK (content_type = 'image/webp'),
  image_data bytea NOT NULL,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 4194304 AND byte_size = octet_length(image_data)),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
