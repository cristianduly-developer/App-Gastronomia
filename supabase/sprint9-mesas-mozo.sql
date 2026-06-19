-- Sprint 9: Asignación de mesas a mozos

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS mesas_asignadas uuid[] DEFAULT NULL;
-- NULL = cubre todas las mesas
-- array vacío [] = no tiene mesas asignadas (no debería pasar, pero por las dudas)
-- array con ids = cubre solo esas mesas
