'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

const PERIODOS = [
  { label: 'Hoy',     dias: 0 },
  { label: '7 días',  dias: 7 },
  { label: '30 días', dias: 30 },
  { label: '3 meses', dias: 90 },
] as const

const TABS = ['General', 'Salón', 'Delivery', 'QR', 'Ventas rápidas'] as const
type Tab = typeof TABS[number]

interface ResumenOrigen {
  total: number
  cantidad: number
  ticketPromedio: number
}

interface ProductoTop { nombre: string; cantidad: number; total: number }
interface VentaDia    { fecha: string; total: number }

interface DatosCompletos {
  rapidas:  ResumenOrigen
  salon:    ResumenOrigen
  delivery: ResumenOrigen
  qr:       ResumenOrigen
  totalGlobal: number
  metodoPago: { efectivo: number; transferencia: number; debito: number; credito: number }
  porDia: VentaDia[]
  topRapidas:  ProductoTop[]
  topSalon:    ProductoTop[]
  topDelivery: ProductoTop[]
}

function desde(dias: number) {
  const d = new Date()
  if (dias === 0) d.setHours(0, 0, 0, 0)
  else { d.setDate(d.getDate() - dias); d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

function fmtPeso(n: number) { return `$${n.toLocaleString('es-AR')}` }
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function ReportesPage() {
  const { localId, nombreNegocio } = useSession()
  const [periodo, setPeriodo] = useState(7)
  const [tab, setTab] = useState<Tab>('General')
  const [loading, setLoading] = useState(true)
  const [datos, setDatos] = useState<DatosCompletos | null>(null)

  useEffect(() => { if (localId) cargar() }, [localId, periodo])

  const cargar = async () => {
    setLoading(true)
    const d = desde(periodo)

    const [
      { data: ventas },
      { data: itemsVenta },
      { data: comandas },
      { data: itemsComanda },
      { data: delivery },
      { data: itemsDelivery },
      { data: qr },
    ] = await Promise.all([
      supabaseApp.from('ventas').select('total, metodo_pago, created_at').eq('local_id', localId).eq('estado', 'completada').gte('created_at', d),
      supabaseApp.from('items_venta').select('nombre, cantidad, subtotal, ventas!inner(local_id,estado,created_at)').eq('ventas.local_id', localId).eq('ventas.estado', 'completada').gte('ventas.created_at', d),
      supabaseApp.from('comandas').select('total, created_at').eq('local_id', localId).eq('estado', 'cerrada').gte('created_at', d),
      supabaseApp.from('items_comanda').select('nombre, cantidad, precio_unitario, comandas!inner(local_id,estado,created_at)').eq('comandas.local_id', localId).eq('comandas.estado', 'cerrada').gte('comandas.created_at', d),
      supabaseApp.from('pedidos_delivery').select('total, metodo_pago, created_at').eq('local_id', localId).eq('estado', 'entregado').gte('created_at', d),
      supabaseApp.from('items_pedido_delivery').select('nombre, cantidad, precio_unitario, pedidos_delivery!inner(local_id,estado,created_at)').eq('pedidos_delivery.local_id', localId).eq('pedidos_delivery.estado', 'entregado').gte('pedidos_delivery.created_at', d),
      supabaseApp.from('pedidos_qr').select('total, created_at').eq('local_id', localId).eq('estado', 'aceptado').gte('created_at', d),
    ])

    const suma = (arr: any[]) => arr.reduce((s, v) => s + Number(v.total), 0)
    const resumen = (arr: any[]): ResumenOrigen => ({
      total: suma(arr),
      cantidad: arr.length,
      ticketPromedio: arr.length > 0 ? Math.round(suma(arr) / arr.length) : 0,
    })

    const vs = ventas ?? []
    const metodoPago = {
      efectivo:      vs.filter((v) => v.metodo_pago === 'efectivo').reduce((s, v) => s + Number(v.total), 0)
                   + (delivery ?? []).filter((v) => v.metodo_pago === 'efectivo').reduce((s, v) => s + Number(v.total), 0),
      transferencia: vs.filter((v) => v.metodo_pago === 'transferencia').reduce((s, v) => s + Number(v.total), 0)
                   + (delivery ?? []).filter((v) => v.metodo_pago === 'transferencia').reduce((s, v) => s + Number(v.total), 0),
      debito:        vs.filter((v) => v.metodo_pago === 'debito').reduce((s, v) => s + Number(v.total), 0)
                   + (delivery ?? []).filter((v) => v.metodo_pago === 'debito').reduce((s, v) => s + Number(v.total), 0),
      credito:       vs.filter((v) => v.metodo_pago === 'credito').reduce((s, v) => s + Number(v.total), 0)
                   + (delivery ?? []).filter((v) => v.metodo_pago === 'credito').reduce((s, v) => s + Number(v.total), 0),
    }

    // Ventas por día (todos los orígenes)
    const porDiaMap: Record<string, number> = {}
    const addDia = (arr: any[]) => arr.forEach((v) => {
      const f = fmtFecha(v.created_at)
      porDiaMap[f] = (porDiaMap[f] ?? 0) + Number(v.total)
    })
    addDia(vs); addDia(comandas ?? []); addDia(delivery ?? []); addDia(qr ?? [])
    const porDia = Object.entries(porDiaMap).map(([fecha, total]) => ({ fecha, total })).slice(-14)

    // Top productos
    const topFrom = (items: any[], campoSubtotal: string): ProductoTop[] => {
      const m: Record<string, { cantidad: number; total: number }> = {}
      ;(items ?? []).forEach((i: any) => {
        if (!m[i.nombre]) m[i.nombre] = { cantidad: 0, total: 0 }
        m[i.nombre].cantidad += Number(i.cantidad)
        m[i.nombre].total += Number(i[campoSubtotal]) * Number(i.cantidad)
      })
      return Object.entries(m).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8)
    }

    const rapidas  = resumen(vs)
    const salon    = resumen(comandas ?? [])
    const del_     = resumen(delivery ?? [])
    const qrRes    = resumen(qr ?? [])

    setDatos({
      rapidas, salon, delivery: del_, qr: qrRes,
      totalGlobal: rapidas.total + salon.total + del_.total + qrRes.total,
      metodoPago,
      porDia,
      topRapidas:  topFrom(itemsVenta ?? [], 'subtotal'),
      topSalon:    topFrom(itemsComanda ?? [], 'precio_unitario'),
      topDelivery: topFrom(itemsDelivery ?? [], 'precio_unitario'),
    })
    setLoading(false)
  }

  const exportarPDF = () => {
    if (!datos) return
    const periodoLabel = PERIODOS.find((p) => p.dias === periodo)?.label ?? ''
    const ahora = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const fila = (label: string, valor: string, negrita = false) =>
      `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;${negrita ? 'font-weight:600' : 'color:#6b7280'}">${label}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:${negrita ? '700' : '400'}">${valor}</td>
      </tr>`

    const tablaTop = (items: ProductoTop[]) => items.length === 0 ? '<p style="color:#9ca3af;font-size:13px;padding:8px 0">Sin datos</p>' :
      `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="border-bottom:2px solid #e5e7eb">
          <th style="padding:6px 8px;text-align:left;color:#6b7280">#</th>
          <th style="padding:6px 8px;text-align:left;color:#6b7280">Producto</th>
          <th style="padding:6px 8px;text-align:right;color:#6b7280">Cant.</th>
          <th style="padding:6px 8px;text-align:right;color:#6b7280">Total</th>
        </tr></thead>
        <tbody>${items.map((p, i) => `<tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:6px 8px;color:#9ca3af">${i + 1}</td>
          <td style="padding:6px 8px">${p.nombre}</td>
          <td style="padding:6px 8px;text-align:right">${p.cantidad}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtPeso(p.total)}</td>
        </tr>`).join('')}</tbody>
      </table>`

    const seccion = (titulo: string, r: ResumenOrigen, top: ProductoTop[]) =>
      `<div style="margin-top:24px;padding:16px;border:1px solid #e5e7eb;border-radius:12px">
        <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111">${titulo}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
          ${fila('Total', fmtPeso(r.total), true)}
          ${fila('Cantidad de operaciones', String(r.cantidad))}
          ${fila('Ticket promedio', fmtPeso(r.ticketPromedio))}
        </table>
        <p style="font-size:12px;color:#6b7280;margin:8px 0 4px">Más vendidos</p>
        ${tablaTop(top)}
      </div>`

    const html = `
      <html><head><title>Reporte — ${nombreNegocio ?? 'GastroApp'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #111; padding: 32px; font-size: 14px; }
        @media print { button { display: none !important; } }
      </style></head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
          <div>
            <h1 style="font-size:22px;font-weight:800">${nombreNegocio ?? 'GastroApp'}</h1>
            <p style="color:#6b7280;font-size:13px;margin-top:4px">Reporte de ventas — ${periodoLabel}</p>
          </div>
          <div style="text-align:right">
            <p style="font-size:12px;color:#9ca3af">${ahora}</p>
          </div>
        </div>

        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="font-size:12px;color:#7c3aed;font-weight:600;margin-bottom:8px">RESUMEN GLOBAL</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${fila('Total general', fmtPeso(datos.totalGlobal), true)}
            ${fila('Ventas rápidas', fmtPeso(datos.rapidas.total))}
            ${fila('Salón (comandas)', fmtPeso(datos.salon.total))}
            ${fila('Delivery', fmtPeso(datos.delivery.total))}
            ${fila('QR (pedidos mesa)', fmtPeso(datos.qr.total))}
          </table>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px">MÉTODOS DE PAGO</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${fila('Efectivo', fmtPeso(datos.metodoPago.efectivo))}
            ${fila('Transferencia', fmtPeso(datos.metodoPago.transferencia))}
            ${fila('Débito', fmtPeso(datos.metodoPago.debito))}
            ${fila('Crédito', fmtPeso(datos.metodoPago.credito))}
          </table>
        </div>

        ${seccion('💰 Ventas rápidas', datos.rapidas, datos.topRapidas)}
        ${seccion('🪑 Salón', datos.salon, datos.topSalon)}
        ${seccion('🛵 Delivery', datos.delivery, datos.topDelivery)}

        <div style="margin-top:24px;padding:16px;border:1px solid #e5e7eb;border-radius:12px">
          <h3 style="margin:0 0 12px;font-size:15px;font-weight:700">📱 Pedidos QR</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${fila('Total', fmtPeso(datos.qr.total), true)}
            ${fila('Cantidad de pedidos', String(datos.qr.cantidad))}
            ${fila('Ticket promedio', fmtPeso(datos.qr.ticketPromedio))}
          </table>
        </div>

        <div style="margin-top:32px;text-align:center">
          <button onclick="window.print()" style="background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer">
            Imprimir / Guardar PDF
          </button>
        </div>
      </body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  const maxDia = Math.max(...(datos?.porDia.map((d) => d.total) ?? [1]), 1)

  return (
    <RouteGuard permiso="verReportes">
      <div className="max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-white">Reportes</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {PERIODOS.map((p) => (
                <button key={p.dias} onClick={() => setPeriodo(p.dias)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                    ${periodo === p.dias ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={exportarPDF}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-medium transition">
              📄 Exportar PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 border-b border-gray-800 pb-0 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px
                ${tab === t ? 'border-violet-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !datos ? null : (

          <>
            {/* TAB GENERAL */}
            {tab === 'General' && (
              <div className="space-y-5">
                {/* Cards por origen */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Ventas rápidas', emoji: '💰', data: datos.rapidas,  color: 'border-violet-700 bg-violet-950/40' },
                    { label: 'Salón',          emoji: '🪑', data: datos.salon,    color: 'border-blue-700 bg-blue-950/40' },
                    { label: 'Delivery',       emoji: '🛵', data: datos.delivery, color: 'border-orange-700 bg-orange-950/40' },
                    { label: 'QR mesas',       emoji: '📱', data: datos.qr,       color: 'border-green-700 bg-green-950/40' },
                  ].map(({ label, emoji, data, color }) => (
                    <div key={label} className={`border rounded-2xl p-4 ${color}`}>
                      <p className="text-xs text-gray-400 mb-1">{emoji} {label}</p>
                      <p className="text-2xl font-bold text-white">{fmtPeso(data.total)}</p>
                      <p className="text-xs text-gray-500 mt-1">{data.cantidad} operaciones</p>
                    </div>
                  ))}
                </div>

                {/* Total global */}
                <div className="bg-violet-950/50 border border-violet-800 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-violet-300">Total general</p>
                    <p className="text-4xl font-black text-white mt-1">{fmtPeso(datos.totalGlobal)}</p>
                  </div>
                  <span className="text-5xl">📊</span>
                </div>

                {/* Métodos de pago */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h2 className="font-semibold text-white mb-4">Por método de pago</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Efectivo',      valor: datos.metodoPago.efectivo,      color: 'bg-green-500' },
                      { label: 'Transferencia', valor: datos.metodoPago.transferencia, color: 'bg-blue-500' },
                      { label: 'Débito',        valor: datos.metodoPago.debito,        color: 'bg-violet-500' },
                      { label: 'Crédito',       valor: datos.metodoPago.credito,       color: 'bg-amber-500' },
                    ].map(({ label, valor, color }) => {
                      const pct = datos.totalGlobal > 0 ? Math.round((valor / datos.totalGlobal) * 100) : 0
                      return (
                        <div key={label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-300">{label}</span>
                            <span className="text-sm font-semibold text-white">{fmtPeso(valor)} <span className="text-gray-500 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Gráfico por día */}
                {datos.porDia.length > 1 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h2 className="font-semibold text-white mb-5">Ventas por día (todos los orígenes)</h2>
                    <div className="flex items-end gap-1.5 h-36">
                      {datos.porDia.map((d) => (
                        <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="w-full bg-violet-600 hover:bg-violet-500 rounded-t-lg transition relative"
                            style={{ height: `${Math.max((d.total / maxDia) * 100, 4)}%` }}>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                              {fmtPeso(d.total)}
                            </div>
                          </div>
                          <span className="text-xs text-gray-600">{d.fecha}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB SALON */}
            {tab === 'Salón' && <TabDetalle titulo="Salón" emoji="🪑" resumen={datos.salon} top={datos.topSalon} color="blue" />}

            {/* TAB DELIVERY */}
            {tab === 'Delivery' && <TabDetalle titulo="Delivery" emoji="🛵" resumen={datos.delivery} top={datos.topDelivery} color="orange" />}

            {/* TAB QR */}
            {tab === 'QR' && (
              <div className="space-y-5">
                <ResumenCards resumen={datos.qr} color="green" />
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center text-gray-500">
                  <p className="text-4xl mb-3">📱</p>
                  <p className="text-sm">Los pedidos QR se contabilizan en el total de Salón al cerrarse la comanda.</p>
                </div>
              </div>
            )}

            {/* TAB VENTAS RAPIDAS */}
            {tab === 'Ventas rápidas' && <TabDetalle titulo="Ventas rápidas" emoji="💰" resumen={datos.rapidas} top={datos.topRapidas} color="violet" />}
          </>
        )}
      </div>
    </RouteGuard>
  )
}

function ResumenCards({ resumen, color }: { resumen: ResumenOrigen; color: string }) {
  const colors: Record<string, string> = {
    violet: 'border-violet-700 bg-violet-950/40',
    blue:   'border-blue-700 bg-blue-950/40',
    orange: 'border-orange-700 bg-orange-950/40',
    green:  'border-green-700 bg-green-950/40',
  }
  return (
    <div className={`grid grid-cols-3 gap-3`}>
      {[
        { label: 'Total', value: `$${resumen.total.toLocaleString('es-AR')}` },
        { label: 'Operaciones', value: String(resumen.cantidad) },
        { label: 'Ticket promedio', value: `$${resumen.ticketPromedio.toLocaleString('es-AR')}` },
      ].map(({ label, value }) => (
        <div key={label} className={`border rounded-2xl p-4 ${colors[color]}`}>
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  )
}

function TabDetalle({ titulo, emoji, resumen, top, color }: {
  titulo: string; emoji: string; resumen: ResumenOrigen; top: ProductoTop[]; color: string
}) {
  return (
    <div className="space-y-5">
      <ResumenCards resumen={resumen} color={color} />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <span>{emoji}</span>
          <h2 className="font-semibold text-white">Productos más vendidos — {titulo}</h2>
        </div>
        {top.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-10">Sin datos para este período</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Unidades</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {top.map((p, i) => (
                <tr key={p.nombre} className="hover:bg-gray-800/30 transition">
                  <td className="px-5 py-3 text-xs text-gray-600">{i + 1}</td>
                  <td className="px-5 py-3 text-sm text-white">{p.nombre}</td>
                  <td className="px-5 py-3 text-sm text-gray-300 text-right">{p.cantidad}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-white text-right">${p.total.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
