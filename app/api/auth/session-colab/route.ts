import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: colab } = await supabaseAdmin
    .from('colaboradores')
    .select('local_id, rol, activo')
    .eq('email', user.email.toLowerCase())
    .eq('activo', true)
    .maybeSingle()

  if (!colab) {
    return NextResponse.json({ colab: null })
  }

  return NextResponse.json({ colab })
}
