import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findUserByEmail } from '@solucionesmdp/core/auth'

export async function POST(req: NextRequest) {
  const appKey = req.headers.get('x-app-key')
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { org_id } = body
  if (!org_id) return NextResponse.json({ ok: false, error: 'org_id requerido' }, { status: 400 })

  try {
    const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!)
    const { data: org } = await central.from('organizaciones').select('email_contacto').eq('id', org_id).single()
    if (!org) return NextResponse.json({ ok: false, error: 'org no encontrada' }, { status: 404 })

    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await findUserByEmail(supa, org.email_contacto)
    if (!user) return NextResponse.json({ ok: true, msg: 'usuario no encontrado' })

    const uid = user.id

    // Gastro usa local_id = auth user id como tenant
    // items_comanda y items_venta van por comanda_id/venta_id
    const { data: comandas } = await supa.from('comandas').select('id').eq('local_id', uid)
    const comandaIds = comandas?.map((c: any) => c.id) || []
    if (comandaIds.length) await supa.from('items_comanda').delete().in('comanda_id', comandaIds)

    const { data: ventas } = await supa.from('ventas').select('id').eq('local_id', uid)
    const ventaIds = ventas?.map((v: any) => v.id) || []
    if (ventaIds.length) await supa.from('items_venta').delete().in('venta_id', ventaIds)

    const { data: combos } = await supa.from('combos').select('id').eq('local_id', uid)
    const comboIds = combos?.map((c: any) => c.id) || []
    if (comboIds.length) await supa.from('combo_items').delete().in('combo_id', comboIds)

    await supa.from('comandas').delete().eq('local_id', uid)
    await supa.from('ventas').delete().eq('local_id', uid)
    const { data: pedidosDelivery } = await supa.from('pedidos_delivery').select('id').eq('local_id', uid)
    const pedidoDeliveryIds = pedidosDelivery?.map((p: any) => p.id) || []
    if (pedidoDeliveryIds.length) await supa.from('items_pedido_delivery').delete().in('pedido_delivery_id', pedidoDeliveryIds)

    await supa.from('pedidos_delivery').delete().eq('local_id', uid)
    await supa.from('pedidos_qr').delete().eq('local_id', uid)
    await supa.from('caja').delete().eq('local_id', uid)
    await supa.from('gastos_caja').delete().eq('local_id', uid)
    await supa.from('combos').delete().eq('local_id', uid)
    await supa.from('mesas').delete().eq('local_id', uid)
    await supa.from('colaboradores').delete().eq('local_id', uid)
    await supa.from('sectores').delete().eq('local_id', uid)
    await supa.from('clientes').delete().eq('local_id', uid)
    await supa.from('productos').delete().eq('local_id', uid)
    await supa.from('categorias').delete().eq('local_id', uid)
    await supa.from('config_local').delete().eq('local_id', uid)

    await supa.auth.admin.deleteUser(uid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[eliminar-org]', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
