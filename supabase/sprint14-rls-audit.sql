-- Sprint 14: Auditoría completa RLS + constraints de validación

-- ─── 1. ELIMINAR POLICIES ANON INSERT QUE QUEDARON (nombres en español) ──────
-- El menú público y delivery ahora usan service_role via API routes
DROP POLICY IF EXISTS "publico puede crear pedido delivery"  ON pedidos_delivery;
DROP POLICY IF EXISTS "publico puede crear items delivery"   ON items_pedido_delivery;
DROP POLICY IF EXISTS "pedidos_qr_insert_public"            ON pedidos_qr;
DROP POLICY IF EXISTS "local ve sus items delivery"         ON items_pedido_delivery;
DROP POLICY IF EXISTS "local ve sus pedidos delivery"       ON pedidos_delivery;

-- ─── 2. LIMPIAR POLICIES PÚBLICAS EN CATEGORIAS Y PRODUCTOS ──────────────────
-- El menú QR usa SUPABASE_SERVICE_ROLE_KEY server-side → no necesita anon read
DROP POLICY IF EXISTS "categorias_public_read"       ON categorias;
DROP POLICY IF EXISTS "productos_public_read"        ON productos;
DROP POLICY IF EXISTS "productos_colaboradores_read" ON productos;

-- ─── 3. LIMPIAR DUPLICADOS EN items_comanda ───────────────────────────────────
DROP POLICY IF EXISTS "items_comanda_local"  ON items_comanda;
-- Queda solo "items_comanda_tenant" (la correcta del sprint13)

-- ─── 4. LIMPIAR DUPLICADOS EN config_local ───────────────────────────────────
DROP POLICY IF EXISTS "config_local_public_read" ON config_local;
DROP POLICY IF EXISTS "local_owner_config"       ON config_local;
-- Queda solo "config_local_owner_read"

-- ─── 5. AGREGAR POLICY FALTANTE EN items_pedido_delivery ─────────────────────
DROP POLICY IF EXISTS "items_delivery_tenant" ON items_pedido_delivery;
CREATE POLICY "items_delivery_tenant" ON items_pedido_delivery
  FOR ALL
  USING (
    local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
  );

-- ─── 6. CONSTRAINTS DE VALIDACIÓN ────────────────────────────────────────────
-- Precio no puede ser negativo
ALTER TABLE productos
  ADD CONSTRAINT chk_precio_positivo CHECK (precio >= 0);

ALTER TABLE items_comanda
  ADD CONSTRAINT chk_cantidad_positiva CHECK (cantidad > 0),
  ADD CONSTRAINT chk_subtotal_positivo CHECK (subtotal >= 0);

ALTER TABLE items_venta
  ADD CONSTRAINT chk_items_venta_cantidad CHECK (cantidad > 0),
  ADD CONSTRAINT chk_items_venta_subtotal CHECK (subtotal >= 0);

ALTER TABLE ventas
  ADD CONSTRAINT chk_ventas_total CHECK (total >= 0);

ALTER TABLE pedidos_delivery
  ADD CONSTRAINT chk_delivery_total CHECK (total >= 0);

-- ─── 7. ON DELETE CASCADE FALTANTES ──────────────────────────────────────────
-- items_venta → ventas (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'items_venta_venta_id_fkey' AND table_name = 'items_venta'
  ) THEN
    ALTER TABLE items_venta
      ADD CONSTRAINT items_venta_venta_id_fkey
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- gastos_caja → caja (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gastos_caja_caja_id_fkey' AND table_name = 'gastos_caja'
  ) THEN
    ALTER TABLE gastos_caja
      ADD CONSTRAINT gastos_caja_caja_id_fkey
      FOREIGN KEY (caja_id) REFERENCES caja(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 8. precio_unitario NOT NULL en items_comanda ────────────────────────────
-- Solo si todos los registros existentes ya tienen valor (verificar antes):
-- SELECT count(*), count(precio_unitario) FROM items_comanda;
-- Si son iguales, ejecutar:
-- ALTER TABLE items_comanda ALTER COLUMN precio_unitario SET NOT NULL;

-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
-- Correr esto después para confirmar que no quedan anon INSERT:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
