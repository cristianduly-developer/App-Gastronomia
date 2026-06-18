-- ============================================================
-- APP GASTRONOMÍA — Sprint 2
-- Ejecutar en el SQL Editor de Supabase (app gastronomia)
-- ============================================================

-- ────────────────────────────────────────────
-- TABLA: clientes
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      UUID NOT NULL,
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  observaciones TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_local" ON clientes
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_clientes_local ON clientes(local_id) WHERE activo = TRUE;

-- ────────────────────────────────────────────
-- TABLA: caja
-- Apertura y cierre de caja por turno
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caja (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id        UUID NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  monto_apertura  NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_cierre    NUMERIC(10,2),
  diferencia      NUMERIC(10,2),
  notas_cierre    TEXT,
  abierta_por     UUID REFERENCES auth.users(id),
  cerrada_por     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caja_local" ON caja
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_caja_updated_at
  BEFORE UPDATE ON caja
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────
-- TABLA: gastos_caja
-- Gastos registrados durante un turno
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos_caja (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  caja_id     UUID NOT NULL REFERENCES caja(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE gastos_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gastos_caja_local" ON gastos_caja
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- ────────────────────────────────────────────
-- TABLA: ventas
-- Ventas rápidas (sin mesa)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id       UUID NOT NULL,
  caja_id        UUID REFERENCES caja(id),
  cliente_id     UUID REFERENCES clientes(id) ON DELETE SET NULL,
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  metodo_pago    TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'debito', 'credito')),
  estado         TEXT NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'anulada')),
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id)
);

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_local" ON ventas
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

CREATE TRIGGER trg_ventas_updated_at
  BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ventas_local_fecha ON ventas(local_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);

-- ────────────────────────────────────────────
-- TABLA: items_venta
-- Líneas de cada venta rápida
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items_venta (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id     UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id  UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre       TEXT NOT NULL,
  precio       NUMERIC(10,2) NOT NULL,
  cantidad     INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  subtotal     NUMERIC(10,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE items_venta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_venta_local" ON items_venta
  USING (
    EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = venta_id
      AND v.local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id')
    )
  );

CREATE INDEX IF NOT EXISTS idx_items_venta ON items_venta(venta_id);
