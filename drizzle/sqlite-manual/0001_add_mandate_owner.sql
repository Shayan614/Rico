-- Manual SQLite migration for the active runtime. Not applied automatically.
-- Existing mandates keep owner_id NULL, which makes them visible to nobody.
ALTER TABLE mandates ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX mandates_owner_id_idx ON mandates(owner_id);
