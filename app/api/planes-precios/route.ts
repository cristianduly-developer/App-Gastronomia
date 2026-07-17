import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const central = createClient(process.env.CENTRAL_URL!, process.env.CENTRAL_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await central
    .from('planes_precios')
    .select('plan, precio_mensual, beneficios')
    .eq('app_id', 'app-gastronomia')
  return NextResponse.json({ ok: true, planes: data || [] })
}
