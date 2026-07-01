import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'
const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: emp } = await central
    .from('empleados_organizacion')
    .select('org_id')
    .eq('email', user.email.toLowerCase())
    .limit(1)
    .maybeSingle()

  if (!emp?.org_id) return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })

  const { data: sub } = await central
    .from('suscripciones_apps')
    .select('mp_preapproval_id')
    .eq('org_id', emp.org_id)
    .eq('app_id', 'app-gastronomia')
    .maybeSingle()

  if (!sub?.mp_preapproval_id) return NextResponse.json({ error: 'No tenés débito automático activo.' }, { status: 400 })

  try {
    const r = await fetch(`${SAAS_URL}/api/mp-cancelar-suscripcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: emp.org_id, app_id: 'app-gastronomia', mp_preapproval_id: sub.mp_preapproval_id }),
    })
    return NextResponse.json(await r.json(), { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Error al cancelar la suscripción.' }, { status: 500 })
  }
}
