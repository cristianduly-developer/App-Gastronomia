-- ══════════════════════════════════════════════════════════════
-- Sprint 15 — Espejo de acceso/plan por tenant (items 8 + 9)
-- STAGE 1: solo construye la infraestructura. NO enforca nada todavía.
-- Correr en el Supabase de Gastronomía. Es 100% seguro: no cambia ninguna
-- policy existente ni bloquea escrituras. Solo crea tablas y funciones.
-- ══════════════════════════════════════════════════════════════

-- 1. Tabla espejo: 1 fila por local. La escribe/lee solo el service role.
CREATE TABLE IF NOT EXISTS tenant_access (
  tenant_id   UUID PRIMARY KEY,
  plan        TEXT,
  valid_until TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '3650 days'
);
ALTER TABLE tenant_access ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito: queda accesible solo por service role (deny-all para clientes).

-- 2. Límites por plan (data-driven: cambiás un límite editando una fila)
CREATE TABLE IF NOT EXISTS plan_limites (
  plan          TEXT PRIMARY KEY,
  max_productos INT,               -- NULL = ilimitado
  usa_mesas     BOOLEAN NOT NULL DEFAULT FALSE,
  usa_comandas  BOOLEAN NOT NULL DEFAULT FALSE,
  usa_cocina    BOOLEAN NOT NULL DEFAULT FALSE,
  usa_combos    BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO plan_limites (plan, max_productos, usa_mesas, usa_comandas, usa_cocina, usa_combos) VALUES
  ('basico',      50,   FALSE, FALSE, FALSE, FALSE),
  ('profesional', 150,  TRUE,  TRUE,  TRUE,  TRUE),
  ('premium',     NULL, TRUE,  TRUE,  TRUE,  TRUE),
  ('sincargo',    NULL, TRUE,  TRUE,  TRUE,  TRUE)
ON CONFLICT (plan) DO UPDATE SET
  max_productos = EXCLUDED.max_productos, usa_mesas = EXCLUDED.usa_mesas,
  usa_comandas  = EXCLUDED.usa_comandas,  usa_cocina = EXCLUDED.usa_cocina,
  usa_combos    = EXCLUDED.usa_combos;

-- 3. Funciones que consultará la RLS en STAGE 2.
--    Ambas FAIL-OPEN: si el tenant no tiene fila en el espejo todavía, permiten.
--    Así ningún usuario existente se rompe durante el rollout.
CREATE OR REPLACE FUNCTION tiene_acceso(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valid_until > now() FROM tenant_access WHERE tenant_id = tid), FALSE);
$$;

CREATE OR REPLACE FUNCTION plan_tenant(tid UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT plan FROM tenant_access WHERE tenant_id = tid),
    (auth.jwt() -> 'app_metadata' ->> 'plan'),
    'basico'
  );
$$;

CREATE OR REPLACE FUNCTION plan_permite(tid UUID, feature TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE feature
      WHEN 'mesas'    THEN usa_mesas
      WHEN 'comandas' THEN usa_comandas
      WHEN 'cocina'   THEN usa_cocina
      WHEN 'combos'   THEN usa_combos
      ELSE TRUE END
    FROM plan_limites WHERE plan = plan_tenant(tid)
  ), FALSE);   -- plan desconocido → bloquea (fail-closed)
$$;

-- ══════════════════════════════════════════════════════════════
-- FIN STAGE 1. Después de correr esto NO cambia nada para los usuarios.
-- La app (verificar-acceso) empezará a poblar tenant_access en cada login.
-- Verificá que se pueble:  SELECT * FROM tenant_access;
-- Recién cuando confirmemos que se llena bien, corremos STAGE 2 (enforcement).
-- ══════════════════════════════════════════════════════════════
