-- Sprint 10: Layout visual del salón
-- Agrega posición x/y a mesas para el editor drag & drop

ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS pos_x INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pos_y INTEGER DEFAULT NULL;
