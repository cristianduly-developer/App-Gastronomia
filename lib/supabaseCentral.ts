import { createClient } from '@supabase/supabase-js'

const CENTRAL_URL = process.env.CENTRAL_URL!
const CENTRAL_KEY = process.env.CENTRAL_SERVICE_KEY!

export interface AccesoResult {
  tiene_acceso: boolean
  ret_org_id: string
  nombre_docente: string
  estado: 'activo' | 'demo' | 'impago' | 'suspendido'
  dias_restantes: number | null
  plan: 'basico' | 'profesional' | 'premium' | 'sincargo'
}

export async function verificarAcceso(email: string): Promise<AccesoResult | null> {
  const client = createClient(CENTRAL_URL, CENTRAL_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await client.rpc('verificar_acceso_email', {
    email_param: email,
    app_id_param: 'app-gastronomia',
  })

  console.log('[central] url:', CENTRAL_URL, 'key defined:', !!CENTRAL_KEY)
  console.log('[central] rpc data:', JSON.stringify(data), 'error:', JSON.stringify(error))

  if (error) return null
  if (!data) return null
  const result = Array.isArray(data) ? data[0] : data
  if (!result) return null
  return result as AccesoResult
}
