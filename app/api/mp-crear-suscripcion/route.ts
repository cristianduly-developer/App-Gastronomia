import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'
  const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { plan } = await req.json()
  if (!plan) return NextResponse.json({ error: 'plan requerido' }, { status: 400 })

  // Resolver la org del usuario autenticado (nunca tomar una org arbitraria)
  const { data: emp } = await central
    .from('empleados_organizacion')
    .select('org_id')
    .eq('email', user.email.toLowerCase())
    .limit(1)
    .maybeSingle()
  const orgId = emp?.org_id

  if (!orgId) return NextResponse.json({ error: 'No se encontró tu organización.' }, { status: 404 })

  try {
    const r = await fetch(`${SAAS_URL}/api/mp-crear-suscripcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ org_id: orgId, app_id: 'app-gastronomia', plan }),
    })
    const body = await r.json()
    console.log('[mp-crear-suscripcion] SAAS status:', r.status, 'body:', JSON.stringify(body))
    return NextResponse.json(body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Error al conectar con el servicio de pagos.' }, { status: 500 })
  }
}
