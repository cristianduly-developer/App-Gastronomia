import { NextRequest, NextResponse } from 'next/server'

const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'

export async function POST(req: NextRequest) {
  const { org_id, plan } = await req.json()
  if (!org_id || !plan) return NextResponse.json({ error: 'org_id y plan requeridos' }, { status: 400 })

  try {
    const r = await fetch(`${SAAS_URL}/api/mp-crear-suscripcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.ERROR_REPORT_KEY || '' },
      body: JSON.stringify({ org_id, app_id: 'app-gastronomia', plan }),
    })
    return NextResponse.json(await r.json(), { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: 'Error al conectar con el servicio de pagos.' }, { status: 500 })
  }
}
