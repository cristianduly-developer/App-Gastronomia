import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'

export async function POST(req: NextRequest) {
  const { localId, plan, userId, isOwner } = await req.json()

  if (!localId || !plan || !userId) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  // Verificar que el token pertenece al userId declarado
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user || user.id !== userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const email = user.email!

  // Validar que el localId pertenece realmente a este usuario
  // Opción A: es colaborador de ese local
  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('local_id')
    .eq('email', email.toLowerCase())
    .eq('local_id', localId)
    .eq('activo', true)
    .maybeSingle()

  if (!colab) {
    // Opción B: es propietario verificado por el SaaS central
    const acceso = await verificarAcceso(email)
    console.log('[set-tenant] acceso:', JSON.stringify({ tiene_acceso: acceso?.tiene_acceso, ret_org_id: acceso?.ret_org_id, localId }))
    if (!acceso?.tiene_acceso || acceso.ret_org_id !== localId) {
      return NextResponse.json({ error: 'localId no autorizado para este usuario' }, { status: 403 })
    }
  }

  // Actualizar app_metadata en el JWT
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { local_id: localId, plan, is_owner: isOwner },
  })

  if (updateError) {
    return NextResponse.json({ error: 'Error actualizando sesión' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
