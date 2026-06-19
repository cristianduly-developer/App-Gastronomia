import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { qrLimiter, checkMemRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const body = await req.json()
  const { localId, mesaId, mesaNombre, items, total } = body

  if (!localId || !mesaId || !items?.length || !total) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const key = `${ip}:${localId}:${mesaId}`
  if (qrLimiter) {
    const { success } = await qrLimiter.limit(key)
    if (!success) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  } else if (!checkMemRateLimit(key, 10)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  // Verificar que el local_id existe (previene spam a localIds inventados)
  const { data: config } = await supabaseAdmin
    .from('config_local')
    .select('local_id')
    .eq('local_id', localId)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('pedidos_qr').insert({
    local_id: localId,
    mesa_id: mesaId,
    mesa_nombre: mesaNombre,
    items,
    total,
  })

  if (error) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
