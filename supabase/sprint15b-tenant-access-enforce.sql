-- ══════════════════════════════════════════════════════════════
-- Sprint 15b — ENFORCEMENT (items 8 + 9). Correr DESPUÉS de sprint15.
-- Gatea ESCRITURA (insert/update) por acceso vigente + plan.
-- La LECTURA (select) queda 100% intacta → un vencido ve sus datos pero no escribe.
-- Todo con policies RESTRICTIVE (se combinan con AND). NO modifica policies
-- existentes. Reversible con el bloque de ROLLBACK del final.
-- ══════════════════════════════════════════════════════════════

-- ── A. Gate de ACCESO vigente en escritura (item 8) ──
-- Se aplica a cada tabla de datos que tenga columna local_id.
DO $$
DECLARE t TEXT;
DECLARE tablas TEXT[] := ARRAY[
  'productos','ventas','comandas','clientes','gastos_caja','caja','mesas',
  'combos','categorias','sectores','pedidos_delivery','pedidos_qr',
  'config_local','colaboradores','items_comanda'
];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = t AND column_name = 'local_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
      EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
      EXECUTE format('CREATE POLICY acc_ins_%1$s ON %1$s AS RESTRICTIVE FOR INSERT WITH CHECK (tiene_acceso(local_id))', t);
      EXECUTE format('CREATE POLICY acc_upd_%1$s ON %1$s AS RESTRICTIVE FOR UPDATE WITH CHECK (tiene_acceso(local_id))', t);
    END IF;
  END LOOP;
END $$;

-- ── B. Límite de CANTIDAD de productos por plan (item 9) ──
CREATE OR REPLACE FUNCTION chk_limite_productos() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max INT; v_count INT;
BEGIN
  SELECT max_productos INTO v_max FROM plan_limites WHERE plan = plan_tenant(NEW.local_id);
  IF v_max IS NULL THEN RETURN NEW; END IF;           -- ilimitado o plan desconocido
  SELECT count(*) INTO v_count FROM productos WHERE local_id = NEW.local_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Límite de productos del plan alcanzado (%). Actualizá el plan.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_limite_productos ON productos;
CREATE TRIGGER trg_limite_productos BEFORE INSERT ON productos
  FOR EACH ROW EXECUTE FUNCTION chk_limite_productos();

-- ── C. Gate de FEATURES por plan (item 9): mesas / comandas / combos ──
DROP POLICY IF EXISTS feat_ins_mesas ON mesas;
CREATE POLICY feat_ins_mesas ON mesas AS RESTRICTIVE FOR INSERT WITH CHECK (plan_permite(local_id, 'mesas'));
DROP POLICY IF EXISTS feat_ins_comandas ON comandas;
CREATE POLICY feat_ins_comandas ON comandas AS RESTRICTIVE FOR INSERT WITH CHECK (plan_permite(local_id, 'comandas'));
DROP POLICY IF EXISTS feat_ins_combos ON combos;
CREATE POLICY feat_ins_combos ON combos AS RESTRICTIVE FOR INSERT WITH CHECK (plan_permite(local_id, 'combos'));

-- ══════════════════════════════════════════════════════════════
-- ROLLBACK (si algo sale mal, corré ESTO y todo vuelve a como estaba):
-- ──────────────────────────────────────────────────────────────
-- DO $$ DECLARE t TEXT; DECLARE tablas TEXT[] := ARRAY['productos','ventas','comandas','clientes','gastos_caja','caja','mesas','combos','categorias','sectores','pedidos_delivery','pedidos_qr','config_local','colaboradores','items_comanda'];
-- BEGIN FOREACH t IN ARRAY tablas LOOP
--   EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
--   EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
-- END LOOP; END $$;
-- DROP TRIGGER IF EXISTS trg_limite_productos ON productos;
-- DROP POLICY IF EXISTS feat_ins_mesas ON mesas;
-- DROP POLICY IF EXISTS feat_ins_comandas ON comandas;
-- DROP POLICY IF EXISTS feat_ins_combos ON combos;
-- ══════════════════════════════════════════════════════════════
