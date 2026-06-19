-- Sprint 13: Agregar local_id a items_comanda para filtrar Realtime por tenant

-- 1. Agregar columna (nullable primero para no romper filas existentes)
ALTER TABLE items_comanda
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES config_local(local_id) ON DELETE CASCADE;

-- 2. Backfill desde la tabla comandas
UPDATE items_comanda ic
SET local_id = c.local_id
FROM comandas c
WHERE ic.comanda_id = c.id
  AND ic.local_id IS NULL;

-- 3. Índice para Realtime filter y queries por tenant
CREATE INDEX IF NOT EXISTS idx_items_comanda_local_id ON items_comanda(local_id);

-- 4. Actualizar RLS: items_comanda accesible solo por su tenant
-- (Si ya tenés una policy, dropearla primero)
DROP POLICY IF EXISTS "items_comanda_tenant"      ON items_comanda;
DROP POLICY IF EXISTS "items_comanda_local_read"  ON items_comanda;
DROP POLICY IF EXISTS "Enable read for tenant"    ON items_comanda;

CREATE POLICY "items_comanda_tenant" ON items_comanda
  FOR ALL
  USING (
    local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
  );

-- 5. Verificar resultado
-- SELECT count(*), count(local_id) FROM items_comanda;
-- Si count = count(local_id): backfill completo, podés hacer la columna NOT NULL:
-- ALTER TABLE items_comanda ALTER COLUMN local_id SET NOT NULL;
