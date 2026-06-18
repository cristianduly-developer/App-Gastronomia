-- ============================================================
-- APP GASTRONOMÍA — Sprint 1
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────
-- TABLA: config_local
-- Una fila por local con flags y datos del negocio
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_local (
  local_id            UUID PRIMARY KEY,
  nombre_negocio      TEXT NOT NULL DEFAULT '',
  tipo_negocio        TEXT,
  telefono            TEXT,
  logo_url            TEXT,
  usa_mesas           BOOLEAN NOT NULL DEFAULT FALSE,
  usa_delivery        BOOLEAN NOT NULL DEFAULT FALSE,
  usa_cocina          BOOLEAN NOT NULL DEFAULT FALSE,
  usa_qr              BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config_local ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_owner_config" ON config_local
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- ────────────────────────────────────────────
-- TABLA: colaboradores
-- Usuarios con rol asignado por el owner
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  email       TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('cajero', 'mozo', 'cocina')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (local_id, email)
);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_owner" ON colaboradores
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- ────────────────────────────────────────────
-- TABLA: categorias
-- Agrupadores de productos (soft delete)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL,
  nombre      TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_local" ON categorias
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- ────────────────────────────────────────────
-- TABLA: productos
-- Catálogo del local (soft delete + agotado)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      UUID NOT NULL,
  categoria_id  UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  imagen_url    TEXT,
  agotado       BOOLEAN NOT NULL DEFAULT FALSE,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_local" ON productos
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'))
  WITH CHECK (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- Acceso de lectura para colaboradores del mismo local
CREATE POLICY "productos_colaboradores_read" ON productos
  FOR SELECT
  USING (local_id::text = (auth.jwt() -> 'app_metadata' ->> 'local_id'));

-- ────────────────────────────────────────────
-- FUNCIÓN: updated_at automático
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_config_local_updated_at
  BEFORE UPDATE ON config_local
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categorias_updated_at
  BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categorias_local ON categorias(local_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_productos_local ON productos(local_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON colaboradores(email) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_colaboradores_local ON colaboradores(local_id) WHERE activo = TRUE;

-- ────────────────────────────────────────────
-- REGISTRAR EN EL CENTRAL (ejecutar en Supabase CENTRAL)
-- INSERT INTO apps_config (id, nombre, icono, activa)
-- VALUES ('app-gastronomia', 'App Gastronomía', '🍔', true);
-- ────────────────────────────────────────────
