UPDATE boxsave.boxes b
SET name = l.short_serial,
    updated_at = now()
FROM boxsave.labels l
WHERE l.id = b.label_id
  AND l.short_serial IS NOT NULL
  AND (b.name IS NULL OR btrim(b.name) = '' OR b.name = 'Box ' || b.box_number::text);
