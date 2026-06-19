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

  // Actualizar app_metadata en el JWT
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { local_id: localId, plan, is_owner: isOwner },
  })

  if (updateError) {
    return NextResponse.json({ error: 'Error actualizando sesión' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
