import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'
import { createClient } from '@supabase/supabase-js'

// Espejo de acceso/plan por tenant (items 8+9). valid_until = vencimiento + gracia.
// Se refresca en cada login del dueño. try/catch: si la tabla aún no existe, no rompe el login.
const GRACE_DAYS = 7
async function syncTenantAccess(localId: string, plan: string | null, diasRestantes: number | null) {
  try {
    const dias = (diasRestantes ?? 3650) + GRACE_DAYS
    const validUntil = new Date(Date.now() + dias * 86400000).toISOString()
    await supabaseAdmin.from('tenant_access').upsert(
      { tenant_id: localId, plan: plan ?? 'basico', valid_until: validUntil },
      { onConflict: 'tenant_id' }
    )
  } catch { /* tabla aún no creada: ignorar */ }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user || user.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verificar si es colaborador
  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('local_id, rol, mesas_asignadas')
    .eq('email', email.toLowerCase())
    .eq('activo', true)
    .maybeSingle()

  if (colab) {
    return NextResponse.json({
      esColab: true,
      localId: colab.local_id,
      rol: colab.rol,
      mesasAsignadas: colab.mesas_asignadas ?? null,
    })
  }

  // Verificar contra el central
  const acceso = await verificarAcceso(email)

  if (acceso && acceso.tiene_acceso) {
    // Auto-registrar empleado si no existe
    const central = createClient(
      process.env.CENTRAL_URL!,
      process.env.CENTRAL_SERVICE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data: empExiste } = await central
      .from('empleados_organizacion')
      .select('id')
      .eq('org_id', acceso.ret_org_id)
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (!empExiste) {
      await central.from('empleados_organizacion').insert({
        org_id: acceso.ret_org_id,
        email: email.toLowerCase(),
        nombre: acceso.nombre_docente || null,
        activo: true,
      })
    }
    // Actualizar ultimo_acceso
    const centralPing = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    centralPing.from('suscripciones_apps').update({ ultimo_acceso: new Date().toISOString() }).eq('org_id', acceso.ret_org_id).eq('app_id', 'app-gastronomia').then(() => {})
    await syncTenantAccess(acceso.ret_org_id, acceso.plan, acceso.dias_restantes)
    return NextResponse.json({ esColab: false, acceso })
  }

  // Sin acceso — verificar si está suspendida o impaga
  const central = createClient(
    process.env.CENTRAL_URL!,
    process.env.CENTRAL_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: empData } = await central
    .from('empleados_organizacion')
    .select('org_id')
    .eq('email', email.toLowerCase())
    .limit(1)

  if (empData && empData.length > 0) {
    const { data: subData } = await central
      .from('suscripciones_apps')
      .select('estado')
      .eq('org_id', empData[0].org_id)
      .eq('app_id', 'app-gastronomia')
      .in('estado', ['suspendido', 'impago', 'cancelado'])
      .limit(1)
      .maybeSingle()

    if (subData?.estado) {
      return NextResponse.json({ error: 'cuenta_suspendida', estado: subData.estado, org_id: empData[0].org_id }, { status: 403 })
    }
  }

  return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const email = user.email.toLowerCase()

  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('local_id, rol, mesas_asignadas')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle()

  if (colab) {
    return NextResponse.json({ esColab: true, localId: colab.local_id, rol: colab.rol, mesasAsignadas: colab.mesas_asignadas ?? null })
  }

  const acceso = await verificarAcceso(email)

  if (acceso && acceso.tiene_acceso) {
    const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const orgId = acceso.ret_org_id ?? (acceso as any).org_id
    central.rpc('incrementar_sesion', { p_org_id: orgId, p_app_id: 'app-gastronomia' })
      .then(({ error }) => { if (error) console.error('[verificar-acceso POST] incrementar_sesion error:', error) })
    await syncTenantAccess(orgId, acceso.plan, acceso.dias_restantes)
    return NextResponse.json({ esColab: false, acceso })
  }

  return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
}
