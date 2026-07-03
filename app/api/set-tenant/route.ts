import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'

export async function POST(req: NextRequest) {
  // Autenticar por token — nunca confiar en userId/localId/plan del body
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const email = user.email.toLowerCase()

  // El tenant, el plan y el rol se derivan SIEMPRE de fuentes confiables:
  // 1) tabla colaboradores (local)  2) verificar_acceso_email (central).
  // Así el usuario no puede elegir su propio local_id ni auto-asignarse un plan.
  let localId: string | null = null
  let plan = 'basico'
  let isOwner = false

  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('local_id')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle()

  if (colab) {
    localId = colab.local_id
    isOwner = false
    plan = 'basico'
  } else {
    const acceso = await verificarAcceso(email)
    if (acceso?.tiene_acceso) {
      localId = acceso.ret_org_id
      plan = acceso.plan ?? 'basico'
      isOwner = true
    }
  }

  if (!localId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { local_id: localId, plan, is_owner: isOwner },
  })

  if (updateError) {
    return NextResponse.json({ error: 'Error actualizando sesión' }, { status: 500 })
  }

  console.log(JSON.stringify({
    event: 'tenant_set',
    userId: user.id,
    localId,
    plan,
    isOwner,
    ts: new Date().toISOString(),
  }))

  return NextResponse.json({ ok: true, localId, plan, isOwner })
}
