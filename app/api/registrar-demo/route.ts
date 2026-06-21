import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEMO_DIAS = 28
const APP_ID    = 'app-gastronomia'
const OWNER_ID  = process.env.DEMO_OWNER_ID ?? 'd8eef2e2-7e07-4ec9-9c6e-766addf89cc5'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseApp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const email = user.email.toLowerCase().trim()
  const nombreGoogle = (user.user_metadata?.full_name as string | undefined)?.trim() || null

  const central = createClient(
    process.env.CENTRAL_URL!,
    process.env.CENTRAL_SERVICE_KEY!,
  )

  const nombre = nombreGoogle || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const { data: rpcResult, error: rpcErr } = await central.rpc('registrar_demo', {
    p_email:     email,
    p_nombre:    nombre,
    p_app_id:    APP_ID,
    p_owner_id:  OWNER_ID,
    p_demo_dias: DEMO_DIAS,
  })

  if (rpcErr) {
    console.error('[registrar-demo] Error RPC:', rpcErr)
    return NextResponse.json({ ok: false, error: 'error_central' }, { status: 500 })
  }

  if (rpcResult?.ya_existe) return NextResponse.json({ ok: true, ya_existe: true })

  const orgId = rpcResult?.org_id

  // Crear config_local en la app para que el onboarding funcione
  const { error: configErr } = await supabaseAdmin
    .from('config_local')
    .upsert({
      local_id:     orgId,
      nombre_negocio: '',
      tipo_negocio: 'restaurante',
      onboarding_completo: false,
    }, { onConflict: 'local_id', ignoreDuplicates: true })

  if (configErr) {
    console.error('[registrar-demo] Error creando config_local:', configErr)
  }

  // Notificar al admin por email
  try {
    const { data: orgData } = await central
      .from('organizaciones')
      .select('nombre, email_contacto')
      .eq('id', orgId)
      .single()

    const fechaAlta = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'cristianduly@gmail.com',
        subject: `🆕 Nueva cuenta demo — ${orgData?.nombre ?? email}`,
        html: `
          <h2>🆕 Nueva cuenta demo en App de Gastronomía</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:8px;font-weight:bold;">Nombre</td><td style="padding:8px;">${orgData?.nombre ?? '—'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${orgData?.email_contacto ?? email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">App</td><td style="padding:8px;">Gastronomía</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Plan</td><td style="padding:8px;">Profesional (demo)</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Días de prueba</td><td style="padding:8px;">${DEMO_DIAS} días</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Fecha de alta</td><td style="padding:8px;">${fechaAlta}</td></tr>
          </table>
        `,
      }),
    })
  } catch (mailErr) {
    console.error('[registrar-demo] Error enviando email:', mailErr)
  }

  return NextResponse.json({ ok: true })
}
