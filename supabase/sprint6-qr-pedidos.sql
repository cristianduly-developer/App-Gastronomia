-- ============================================================
-- Sprint 6 — QR con pedidos desde la mesa
-- Ejecutar en SQL Editor de Supabase (app gastronomia)
-- ============================================================

-- Nueva columna en config_local para habilitar pedidos desde QR
ALTER TABLE config_local
  ADD COLUMN IF NOT EXISTS usa_qr_pedidos BOOLEAN NOT NULL DEFAULT FALSE;

-- Tabla pedidos_qr: guarda los pedidos enviados desde el QR del cliente
-- Se asocian a una mesa y quedan pendientes hasta que el mozo/sistema los confirme
CREATE TABLE IF NOT EXISTS pedidos_qr (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  mesa_id     UUID NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  mesa_nombre TEXT NOT NULL,
  items       JSONB NOT NULL DEFAULT '[]',
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptado', 'rechazado')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pedidos_qr ENABLE ROW LEVEL SECURITY;

-- Escritura pública (cualquiera puede crear un pedido desde el QR)
CREATE POLICY "pedidos_qr_insert_public" ON pedidos_qr
  FOR INSERT WITH CHECK (true);

-- Lectura y actualización solo para el local autenticado
CREATE POLICY "pedidos_qr_local_read" ON pedidos_qr
  FOR SELECT
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE POLICY "pedidos_qr_local_update" ON pedidos_qr
  FOR UPDATE
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE INDEX IF NOT EXISTS idx_pedidos_qr_local ON pedidos_qr(local_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_qr_mesa ON pedidos_qr(mesa_id);

-- Habilitar Realtime para que el mozo vea los pedidos QR en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_qr;
