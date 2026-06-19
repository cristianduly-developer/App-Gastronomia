-- Sprint 8: Módulo Delivery

-- 1. Tabla pedidos_delivery
CREATE TABLE IF NOT EXISTS pedidos_delivery (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      uuid NOT NULL REFERENCES config_local(local_id) ON DELETE CASCADE,
  cliente_nombre text NOT NULL,
  cliente_tel    text NOT NULL,
  cliente_dir    text NOT NULL,
  observaciones  text,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  metodo_pago    text NOT NULL DEFAULT 'efectivo',
  estado         text NOT NULL DEFAULT 'recibido', -- recibido | en_cocina | en_camino | entregado | cancelado
  origen         text NOT NULL DEFAULT 'link',     -- link | manual
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Ítems del pedido
CREATE TABLE IF NOT EXISTS items_pedido_delivery (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_delivery_id  uuid NOT NULL REFERENCES pedidos_delivery(id) ON DELETE CASCADE,
  producto_id         uuid REFERENCES productos(id),
  nombre              text NOT NULL,
  precio              numeric(10,2) NOT NULL,
  cantidad            int NOT NULL DEFAULT 1,
  subtotal            numeric(10,2) NOT NULL,
  observacion         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_pedido_delivery ENABLE ROW LEVEL SECURITY;

-- Autenticados del local pueden ver y gestionar
CREATE POLICY "local ve sus pedidos delivery"
ON pedidos_delivery FOR ALL TO authenticated
USING (local_id = (auth.jwt() -> 'app_metadata' ->> 'local_id')::uuid);

CREATE POLICY "local ve sus items delivery"
ON items_pedido_delivery FOR ALL TO authenticated
USING (
  pedido_delivery_id IN (
    SELECT id FROM pedidos_delivery
    WHERE local_id = (auth.jwt() -> 'app_metadata' ->> 'local_id')::uuid
  )
);

-- Público puede insertar (desde el link)
CREATE POLICY "publico puede crear pedido delivery"
ON pedidos_delivery FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "publico puede crear items delivery"
ON items_pedido_delivery FOR INSERT TO anon
WITH CHECK (true);

-- Público puede leer config y carta (para el link público, ya deben existir de sprint5)
-- Si no existen, descomentá:
-- CREATE POLICY "publico lee config" ON config_local FOR SELECT TO anon USING (true);
-- CREATE POLICY "publico lee categorias" ON categorias FOR SELECT TO anon USING (true);
-- CREATE POLICY "publico lee productos" ON productos FOR SELECT TO anon USING (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_delivery;
