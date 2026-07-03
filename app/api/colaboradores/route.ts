import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'
import { createClient } from '@supabase/supabase-js'

const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, email, rol, localId, mesasAsignadas } = await req.json()
  if (!nombre || !email || !localId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // El que agrega colaboradores tiene que ser el dueño de ese local
  const acceso = await verificarAcceso(user.email.toLowerCase())
  if (!acceso?.tiene_acceso || acceso.ret_org_id !== localId) {
    return NextResponse.json({ error: 'No autorizado sobre este local' }, { status: 403 })
  }

  const emailLower = email.trim().toLowerCase()

  // Verificar duplicado en DB local
  const { data: existe } = await supabaseAdmin
    .from('colaboradores')
    .select('id')
    .eq('local_id', localId)
    .eq('email', emailLower)
    .maybeSingle()

  if (existe) return NextResponse.json({ error: 'Ese email ya está registrado como colaborador' }, { status: 409 })

  // Límite de colaboradores por plan (plan real desde la central, no del cliente)
  const LIMITES_COLAB: Record<string, number> = { basico: 1, profesional: 3, premium: 6, sincargo: 6 }
  const limite = LIMITES_COLAB[acceso.plan] ?? 1
  const { count } = await supabaseAdmin
    .from('colaboradores')
    .select('id', { count: 'exact', head: true })
    .eq('local_id', localId)
    .eq('activo', true)
  if ((count ?? 0) >= limite) {
    return NextResponse.json({ error: `Tu plan permite hasta ${limite} colaborador${limite === 1 ? '' : 'es'}. Actualizá el plan para agregar más.` }, { status: 403 })
  }

  // Insertar en DB local
  const { error: localErr } = await supabaseAdmin.from('colaboradores').insert({
    local_id: localId,
    nombre: nombre.trim(),
    email: emailLower,
    rol,
    activo: true,
    mesas_asignadas: mesasAsignadas ?? null,
  })
  if (localErr) return NextResponse.json({ error: localErr.message }, { status: 500 })

  // Insertar en central (empleados_organizacion) — fire and forget
  central.from('empleados_organizacion').upsert({
    org_id: localId,
    email: emailLower,
    nombre: nombre.trim(),
    activo: true,
  }, { onConflict: 'org_id,email', ignoreDuplicates: true }).then(() => {})

  // Notificar al saas-admin-panel
  central.from('notificaciones_admin').insert({
    tipo: 'nuevo_colaborador',
    mensaje: `Nuevo colaborador en App Gastronomía — ${nombre} (${emailLower}) — rol: ${rol}`,
    org_id: localId,
    app_id: 'app-gastronomia',
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
