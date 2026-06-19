-- Sprint 7: Logo del negocio en config_local

-- 1. Columna logo_url
ALTER TABLE config_local ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Bucket público para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: el dueño del local puede subir/actualizar/borrar su logo
CREATE POLICY "owner puede subir logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'local_id')
);

CREATE POLICY "owner puede actualizar logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'local_id')
);

CREATE POLICY "owner puede borrar logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'local_id')
);

-- 4. Policy pública para leer logos (menú QR es público)
CREATE POLICY "logos son publicos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');
