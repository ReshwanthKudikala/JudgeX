-- Sprint 39: contest slug for pretty URLs (/contests/:slug)

ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS slug VARCHAR(120);

-- Backfill temporary slugs for existing rows (stable enough for uniqueness).
UPDATE contests
   SET slug = 'contest-' || REPLACE(id::text, '-', '')
 WHERE slug IS NULL OR slug = '';

ALTER TABLE contests
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contests_slug_active
  ON contests (slug)
  WHERE is_deleted = false;
