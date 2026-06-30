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
  if (carrito.length > 50) {
    return NextResponse.json({ error: 'Demasiados items' }, { status: 400 })
  }

  const key = `${ip}:${localId}`
  if (deliveryLimiter) {
    const { success } = await deliveryLimiter.limit(key)
    if (!success) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  } else if (!checkMemRateLimit(key, 5)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  // Recalcular total server-side usando precios reales de BD
  const productoIds = carrito.map((i: { producto_id: string }) => i.producto_id)
  const { data: productosDB } = await supabaseAdmin
    .from('productos')
    .select('id, precio')
    .eq('local_id', localId)
    .in('id', productoIds)

  if (!productosDB?.length) {
    return NextResponse.json({ error: 'Productos no encontrados' }, { status: 400 })
  }

  const precioMap = Object.fromEntries(productosDB.map((p: { id: string; precio: number }) => [p.id, p.precio]))
  const totalReal = carrito.reduce((acc: number, i: { producto_id: string; cantidad: number }) => {
    return acc + (precioMap[i.producto_id] ?? 0) * i.cantidad
  }, 0)

  const { data: pedido, error } = await supabaseAdmin
    .from('pedidos_delivery')
    .insert({
      local_id: localId,
      cliente_nombre: cliente.nombre,
      cliente_tel: cliente.tel,
      cliente_dir: retiraEnLocal ? 'Retira en el local' : cliente.dir ?? '',
      observaciones: cliente.obs || null,
      total: totalReal,
      metodo_pago: metodoPago ?? 'efectivo',
      estado: 'recibido',
      origen: 'link',
    })
    .select()
    .single()

  if (error || !pedido) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseAdmin.from('items_pedido_delivery').insert(
    carrito.map((i: { producto_id: string; nombre: string; cantidad: number; observacion?: string | null }) => ({
      pedido_delivery_id: pedido.id,
      producto_id: i.producto_id,
      nombre: i.nombre,
      precio: precioMap[i.producto_id] ?? 0,
      precio_unitario: precioMap[i.producto_id] ?? 0,
      cantidad: i.cantidad,
      subtotal: (precioMap[i.producto_id] ?? 0) * i.cantidad,
      observacion: i.observacion ?? null,
    }))
  )

  if (itemsError) {
    await supabaseAdmin.from('pedidos_delivery').delete().eq('id', pedido.id)
    return NextResponse.json({ error: 'Error al registrar los items' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
