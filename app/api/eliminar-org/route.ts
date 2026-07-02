import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const { data: { users } } = await supa.auth.admin.listUsers()
    const user = users?.find((u: { email?: string }) => u.email?.toLowerCase() === org.email_contacto?.toLowerCase())
    if (!user) return NextResponse.json({ ok: true, msg: 'usuario no encontrado' })

    const uid = user.id

    await supa.from('combo_items').delete().eq('user_id', uid)
    await supa.from('combos').delete().eq('user_id', uid)
    await supa.from('items_comanda').delete().eq('user_id', uid)
    await supa.from('comandas').delete().eq('user_id', uid)
    await supa.from('items_venta').delete().eq('user_id', uid)
    await supa.from('ventas').delete().eq('user_id', uid)
    await supa.from('items_pedido_delivery').delete().eq('user_id', uid)
    await supa.from('pedidos_delivery').delete().eq('user_id', uid)
    await supa.from('pedidos_qr').delete().eq('user_id', uid)
    await supa.from('caja').delete().eq('user_id', uid)
    await supa.from('gastos_caja').delete().eq('user_id', uid)
    await supa.from('mesas').delete().eq('user_id', uid)
    await supa.from('colaboradores').delete().eq('user_id', uid)
    await supa.from('sectores').delete().eq('user_id', uid)
    await supa.from('productos').delete().eq('user_id', uid)
    await supa.from('categorias').delete().eq('user_id', uid)
    await supa.from('config_local').delete().eq('user_id', uid)

    await supa.auth.admin.deleteUser(uid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[eliminar-org]', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
