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

  if (!localId || !mesaId || !items?.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }
  if (items.length > 50) {
    return NextResponse.json({ error: 'Demasiados items' }, { status: 400 })
  }

  const key = `${ip}:${localId}:${mesaId}`
  if (qrLimiter) {
    const { success } = await qrLimiter.limit(key)
    if (!success) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  } else if (!checkMemRateLimit(key, 10)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 })
  }

  const { data: config } = await supabaseAdmin
    .from('config_local')
    .select('local_id')
    .eq('local_id', localId)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 })
  }

  const itemsProducto = items.filter((i: any) => i.tipo !== 'combo')
  const itemsCombo = items.filter((i: any) => i.tipo === 'combo')

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
      .select('id, precio, nombre, combo_items(cantidad, productos(nombre))')
      .eq('local_id', localId)
      .in('id', comboIds)

    for (const c of combosDB ?? []) {
      comboPrecioMap[c.id] = c.precio
      const lineas = (c.combo_items ?? []).map((ci: any) => `${ci.cantidad}x ${ci.productos?.nombre ?? ''}`).filter(Boolean)
      comboDetalleMap[c.id] = lineas.join('\n')
    }
  }

  const itemsConPrecio = items.map((i: any) => {
    if (i.tipo === 'combo') {
      const precio = comboPrecioMap[i.producto_id] ?? 0
      return {
        producto_id: i.producto_id,
        nombre: i.nombre,
        precio,
        cantidad: i.cantidad,
        subtotal: precio * i.cantidad,
        observacion: i.observacion ?? null,
        tipo: 'combo',
        combo_detalle: comboDetalleMap[i.producto_id] ?? null,
      }
    }
    const precio = precioMap[i.producto_id] ?? 0
    return {
      producto_id: i.producto_id,
      nombre: i.nombre,
      precio,
      cantidad: i.cantidad,
      subtotal: precio * i.cantidad,
      observacion: i.observacion ?? null,
      tipo: 'producto',
      combo_detalle: null,
    }
  })

  const totalReal = itemsConPrecio.reduce((acc: number, i: any) => acc + i.subtotal, 0)

  const { error } = await supabaseAdmin.from('pedidos_qr').insert({
    local_id: localId,
    mesa_id: mesaId,
    mesa_nombre: mesaNombre,
    items: itemsConPrecio,
    total: totalReal,
  })

  if (error) {
    return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
