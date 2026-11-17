import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const pedidoId = req.nextUrl.searchParams.get('pedidoId')
  if (!pedidoId) {
    return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })
  }

  const { data: pedido } = await supabaseAdmin
    .from('pedidos_qr')
    .select('estado, mesa_id')
    .eq('id', pedidoId)
    .single()

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  if (pedido.estado === 'rechazado' || pedido.estado === 'pendiente') {
    return NextResponse.json({ estado: pedido.estado, itemsListos: false })
  }

  const { data: comanda } = await supabaseAdmin
    .from('comandas')
    .select('id')
    .eq('mesa_id', pedido.mesa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!comanda) {
    return NextResponse.json({ estado: pedido.estado, itemsListos: false })
  }

  const { data: items } = await supabaseAdmin
    .from('items_comanda')
    .select('estado')
    .eq('comanda_id', comanda.id)

  const itemsListos = (items?.length ?? 0) > 0 && items!.every((i) => i.estado === 'listo' || i.estado === 'entregado')

  return NextResponse.json({ estado: pedido.estado, itemsListos })
}
