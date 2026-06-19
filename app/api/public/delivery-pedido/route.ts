import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deliveryLimiter, checkMemRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const body = await req.json()
  const { localId, cliente, carrito, total, metodoPago, retiraEnLocal } = body

  if (!localId || !cliente?.nombre || !cliente?.tel || !carrito?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const key = `${ip}:${localId}`
  if (deliveryLimiter) {
    const { success } = await deliveryLimiter.limit(key)
    if (!success) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  } else if (!checkMemRateLimit(key, 5)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  const { data: pedido, error } = await supabaseAdmin
    .from('pedidos_delivery')
    .insert({
      local_id: localId,
      cliente_nombre: cliente.nombre,
      cliente_tel: cliente.tel,
      cliente_dir: retiraEnLocal ? 'Retira en el local' : cliente.dir ?? '',
      observaciones: cliente.obs || null,
      total,
      metodo_pago: metodoPago ?? 'efectivo',
      estado: 'recibido',
      origen: 'link',
    })
    .select()
    .single()

  if (error || !pedido) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  await supabaseAdmin.from('items_pedido_delivery').insert(
    carrito.map((i: { producto_id: string; nombre: string; precio: number; cantidad: number; subtotal: number; observacion?: string | null }) => ({
      pedido_delivery_id: pedido.id,
      producto_id: i.producto_id,
      nombre: i.nombre,
      precio_unitario: i.precio,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      observacion: i.observacion ?? null,
    }))
  )

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
