import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deliveryLimiter, checkMemRateLimit } from '@/lib/ratelimit'
import { reportarError } from '@/app/lib/reportarError'

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

  const itemsProducto = carrito.filter((i: any) => i.tipo !== 'combo')
  const itemsCombo = carrito.filter((i: any) => i.tipo === 'combo')

  // Validar precios de productos normales
  const productoIds = itemsProducto.map((i: any) => i.producto_id).filter(Boolean)
  const precioMap: Record<string, number> = {}

  if (productoIds.length > 0) {
    const { data: productosDB } = await supabaseAdmin
      .from('productos')
      .select('id, precio')
      .eq('local_id', localId)
      .in('id', productoIds)

    if (!productosDB?.length && itemsProducto.length > 0) {
      return NextResponse.json({ error: 'Productos no encontrados' }, { status: 400 })
    }
    for (const p of productosDB ?? []) precioMap[p.id] = p.precio
  }

  // Validar precios de combos
  const comboIds = itemsCombo.map((i: any) => i.producto_id).filter(Boolean)
  const comboPrecioMap: Record<string, number> = {}

  const comboDetalleMap: Record<string, string> = {}

  if (comboIds.length > 0) {
    const { data: combosDB } = await supabaseAdmin
      .from('combos')
      .select('id, precio, combo_items(cantidad, productos(nombre))')
      .eq('local_id', localId)
      .in('id', comboIds)

    for (const c of combosDB ?? []) {
      comboPrecioMap[c.id] = c.precio
      const lineas = (c.combo_items ?? []).map((ci: any) => `${ci.cantidad}x ${ci.productos?.nombre ?? ''}`).filter(Boolean)
      comboDetalleMap[c.id] = lineas.join('\n')
    }
  }

  const getPrecio = (i: any) => i.tipo === 'combo' ? (comboPrecioMap[i.producto_id] ?? 0) : (precioMap[i.producto_id] ?? 0)
  const totalReal = carrito.reduce((acc: number, i: any) => acc + getPrecio(i) * i.cantidad, 0)

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
    reportarError(error ?? new Error('pedido null'), { pantalla: 'delivery-pedido', accion: 'insert_pedido', metadata: { localId } })
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseAdmin.from('items_pedido_delivery').insert(
    carrito.map((i: any) => {
      const precio = getPrecio(i)
      const esCombo = i.tipo === 'combo'
      return {
        pedido_delivery_id: pedido.id,
        producto_id: esCombo ? null : i.producto_id,
        nombre: i.nombre,
        precio,
        precio_unitario: precio,
        cantidad: i.cantidad,
        subtotal: precio * i.cantidad,
        observacion: i.observacion ?? null,
        tipo: esCombo ? 'combo' : 'producto',
        combo_detalle: esCombo ? (comboDetalleMap[i.producto_id] ?? null) : null,
      }
    })
  )

  if (itemsError) {
    reportarError(itemsError, { pantalla: 'delivery-pedido', accion: 'insert_items', metadata: { localId, pedidoId: pedido.id } })
    await supabaseAdmin.from('pedidos_delivery').delete().eq('id', pedido.id)
    return NextResponse.json({ error: 'Error al registrar los items' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
