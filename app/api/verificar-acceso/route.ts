import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarAcceso } from '@/lib/supabaseCentral'

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

  // Verificar si es colaborador en la app de gastronomía
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

  // Si no es colaborador, verificar contra el central
  const acceso = await verificarAcceso(email)
  if (!acceso || !acceso.tiene_acceso) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  // Auto-registrar el email en empleados_organizacion del central si no existe
  const { createClient } = await import('@supabase/supabase-js')
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
    console.log('empleado auto-registrado en central:', email)
  }

  return NextResponse.json({ esColab: false, acceso })
}
