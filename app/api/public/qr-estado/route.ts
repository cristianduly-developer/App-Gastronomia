import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const pedidoId = req.nextUrl.searchParams.get('pedidoId')
  if (!pedidoId) {
    return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })
  }

  const { data: pedido } = await supabaseAdmin
    .from('pedidos_qr')
    .select('estado, mesa_id, local_id, created_at')
    .eq('id', pedidoId)
    .single()

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  if (pedido.estado === 'rechazado' || pedido.estado === 'pendiente') {
    const { count: pedidosAdelante } = await supabaseAdmin
      .from('pedidos_qr')
      .select('id', { count: 'exact', head: true })
      .eq('local_id', pedido.local_id)
      .in('estado', ['pendiente', 'aceptado'])
      .lt('created_at', pedido.created_at)
    return NextResponse.json({ estado: pedido.estado, itemsListos: false, pedidosAdelante: pedidosAdelante ?? 0 })
  }

  const { data: comanda } = await supabaseAdmin
    .from('comandas')
    .select('id, created_at')
    .eq('mesa_id', pedido.mesa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!comanda) {
    return NextResponse.json({ estado: pedido.estado, itemsListos: false, pedidosAdelante: 0 })
  }

  const { data: items } = await supabaseAdmin
    .from('items_comanda')
    .select('estado')
    .eq('comanda_id', comanda.id)

  const itemsListos = (items?.length ?? 0) > 0 && items!.every((i) => i.estado === 'listo' || i.estado === 'entregado')

  const { count: comandasAdelante } = await supabaseAdmin
    .from('items_comanda')
    .select('comanda_id', { count: 'exact', head: true })
    .eq('local_id', pedido.local_id)
    .in('estado', ['pendiente', 'en_preparacion'])
    .neq('comanda_id', comanda.id)

  return NextResponse.json({ estado: pedido.estado, itemsListos, pedidosAdelante: comandasAdelante ?? 0 })
}
