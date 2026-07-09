'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { ModalPago, type PagoResult } from '@/components/ModalPago'

interface Mesa { id: string; nombre: string; estado: string; sector_id: string }
interface ItemComanda {
  id: string
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
  observacion: string | null
  tanda: number
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
}
interface Comanda {
  id: string
  total: number
  tanda_actual: number
  observaciones: string | null
  created_at: string
  estado: string
}

const ESTADO_ITEM: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: 'text-yellow-400' },
  en_preparacion: { label: 'En preparación', color: 'text-blue-400' },
  listo:          { label: 'Listo',          color: 'text-green-400' },
  entregado:      { label: 'Entregado',      color: 'text-gray-500' },
}

function tiempoDesde(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function MesaDetallePage() {
  const { localId } = useSession()
  const router = useRouter()
  const params = useParams()
  const mesaId = params.id as string

  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [items, setItems] = useState<ItemComanda[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [confirmCobro, setConfirmCobro] = useState(false)

  const cargarDatos = useCallback(async () => {
    const [{ data: m }, { data: cmd }] = await Promise.all([
      supabaseApp.from('mesas').select('*').eq('id', mesaId).single(),
      supabaseApp.from('comandas').select('*').eq('mesa_id', mesaId).eq('estado', 'abierta').maybeSingle(),
    ])
    setMesa(m)
    setComanda(cmd)
    if (cmd) {
      const { data: its } = await supabaseApp
        .from('items_comanda')
        .select('*')
        .eq('comanda_id', cmd.id)
        .order('tanda')
        .order('created_at')
      setItems(its ?? [])
    }
    setLoading(false)
  }, [mesaId])

  useEffect(() => {
    if (!mesaId) return
    cargarDatos()

    const channel = supabaseApp
      .channel(`mesa-${mesaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_comanda', filter: `local_id=eq.${localId}` }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, cargarDatos)
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [mesaId, cargarDatos])

  const pedirCuenta = async () => {
    if (!mesa) return
    setProcesando(true)
    await supabaseApp.from('mesas').update({ estado: 'pidio_cuenta' }).eq('id', mesaId)
    setMesa((m) => m ? { ...m, estado: 'pidio_cuenta' } : m)
    setProcesando(false)
  }

  const imprimirTicket = (pago?: PagoResult) => {
    if (!comanda || !mesa) return
    const ahora = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const lineas = items.map((i) =>
      `<tr>
        <td style="padding:4px 0">${i.cantidad}× ${i.nombre}${i.observacion ? `<br><span style="color:#888;font-size:11px;font-style:italic">${i.observacion}</span>` : ''}</td>
        <td style="padding:4px 0;text-align:right">$${i.subtotal.toLocaleString()}</td>
      </tr>`
    ).join('')

    const metodoLabel: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito' }
    const pagoTexto = pago?.metodo2
      ? `${metodoLabel[pago.metodo1]} $${pago.monto1.toLocaleString()} + ${metodoLabel[pago.metodo2]} $${pago.monto2!.toLocaleString()}`
      : pago ? (metodoLabel[pago.metodo1] ?? pago.metodo1) : ''

    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(`
      <html><head><title>Ticket</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; max-width: 320px; margin: 0 auto; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; color: #555; font-size: 11px; margin-bottom: 12px; }
        .sep { border-top: 1px dashed #999; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        .total-row td { font-weight: bold; font-size: 15px; padding-top: 8px; }
        .metodo { text-align: center; color: #555; font-size: 11px; margin-top: 8px; }
        .gracias { text-align: center; margin-top: 12px; font-size: 12px; color: #777; }
        @media print { button { display: none !important; } }
        .btn { display: block; width: 100%; margin-top: 16px; padding: 10px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
      </style></head>
      <body>
        <h1 id="negocio-nombre">—</h1>
        <p class="sub">${mesa.nombre} · ${ahora}</p>
        <div class="sep"></div>
        <table>
          <tbody>${lineas}</tbody>
        </table>
        <div class="sep"></div>
        <table>
          <tr class="total-row">
            <td>TOTAL</td>
            <td style="text-align:right">$${comanda.total.toLocaleString()}</td>
          </tr>
        </table>
        <p class="metodo">${pagoTexto}</p>
        <p class="gracias">¡Gracias por su visita!</p>
        <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
        <script>
          const stored = localStorage.getItem('gastro-session')
          if (stored) {
            try {
              const s = JSON.parse(stored)
              const nombre = s?.state?.nombreNegocio
              if (nombre) document.getElementById('negocio-nombre').textContent = nombre
            } catch(e) {}
          }
        </script>
      </body></html>
    `)
    ventana.document.close()
  }

  const cobrarComanda = async (pago: PagoResult) => {
    if (!comanda || !mesa) return
    setProcesando(true)
    imprimirTicket(pago)

    await Promise.all([
      supabaseApp.from('comandas').update({
        estado: 'cerrada',
        cerrada_at: new Date().toISOString(),
      }).eq('id', comanda.id),
      supabaseApp.from('mesas').update({ estado: 'libre' }).eq('id', mesaId),
      supabaseApp.from('ventas').insert({
        local_id: localId,
        total: comanda.total,
        metodo_pago: pago.metodo1,
        metodo_pago_2: pago.metodo2 ?? null,
        monto_metodo_1: pago.metodo2 ? pago.monto1 : null,
        monto_metodo_2: pago.metodo2 ? pago.monto2 : null,
        origen: 'comanda',
        referencia_id: comanda.id,
      }),
    ])

    setProcesando(false)
    setConfirmCobro(false)
    router.push('/mesas')
  }

  const cancelarComanda = async () => {
    if (!comanda || !confirm('¿Cancelar esta comanda? Se perderán todos los pedidos.')) return
    setProcesando(true)
    await Promise.all([
      supabaseApp.from('comandas').update({ estado: 'cerrada', cerrada_at: new Date().toISOString() }).eq('id', comanda.id),
      supabaseApp.from('mesas').update({ estado: 'libre' }).eq('id', mesaId),
    ])
    setProcesando(false)
    router.push('/mesas')
  }

  if (loading) {
    return (
      <RouteGuard permiso="verMesas">
        <PlanGuard feature="usaMesas">
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </PlanGuard>
      </RouteGuard>
    )
  }

  if (!mesa) {
    return (
      <RouteGuard permiso="verMesas">
        <PlanGuard feature="usaMesas">
          <p className="text-gray-400">Mesa no encontrada</p>
        </PlanGuard>
      </RouteGuard>
    )
  }

  // Agrupar items por tanda
  const tandas = items.reduce((acc, item) => {
    const t = item.tanda
    if (!acc[t]) acc[t] = []
    acc[t].push(item)
    return acc
  }, {} as Record<number, ItemComanda[]>)

  return (
    <RouteGuard permiso="verMesas">
      <PlanGuard feature="usaMesas">
      <div className="max-w-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">← Volver</button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{mesa.nombre}</h1>
            {comanda && (
              <p className="text-xs text-gray-500">Abierta hace {tiempoDesde(comanda.created_at)}</p>
            )}
          </div>
          {mesa.estado === 'ocupada' && (
            <span className="px-3 py-1 rounded-xl bg-violet-900 text-violet-300 text-xs font-medium">Ocupada</span>
          )}
          {mesa.estado === 'pidio_cuenta' && (
            <span className="px-3 py-1 rounded-xl bg-amber-900 text-amber-300 text-xs font-medium">Pidió cuenta</span>
          )}
        </div>

        {!comanda ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p className="mb-4">No hay comanda abierta en esta mesa</p>
            <button
              onClick={() => router.push(`/mesas/${mesaId}/nueva-comanda`)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition"
            >
              Abrir comanda
            </button>
          </div>
        ) : (
          <>
            {/* Items por tanda */}
            {Object.keys(tandas).length === 0 ? (
              <div className="text-center py-10 text-gray-600 text-sm">
                Sin pedidos aún — agregá ítems
              </div>
            ) : (
              <div className="space-y-5 mb-6">
                {Object.entries(tandas).map(([tanda, its]) => (
                  <div key={tanda} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Tanda {tanda}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {its.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {item.cantidad}× {item.nombre}
                              </span>
                            </div>
                            {item.observacion && (
                              <p className="text-xs text-gray-500 mt-0.5 italic">{item.observacion}</p>
                            )}
                            <span className={`text-xs mt-1 inline-block ${ESTADO_ITEM[item.estado]?.color}`}>
                              {ESTADO_ITEM[item.estado]?.label}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            ${item.subtotal.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total + acciones */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-medium">Total</span>
                <span className="text-2xl font-bold text-white">${comanda.total.toLocaleString()}</span>
              </div>

              <button
                onClick={() => router.push(`/mesas/${mesaId}/nueva-comanda`)}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 text-sm transition"
              >
                + Agregar pedido (tanda {comanda.tanda_actual + 1})
              </button>

              {mesa.estado === 'ocupada' && (
                <button
                  onClick={pedirCuenta}
                  disabled={procesando}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                >
                  Pedir cuenta
                </button>
              )}

              {(mesa.estado === 'pidio_cuenta' || mesa.estado === 'ocupada') && (
                <button
                  onClick={() => setConfirmCobro(true)}
                  disabled={procesando}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                >
                  Cobrar — ${comanda.total.toLocaleString()}
                </button>
              )}

              <button
                onClick={cancelarComanda}
                disabled={procesando}
                className="w-full text-red-400 hover:text-red-300 text-sm transition py-1"
              >
                Cancelar comanda
              </button>
            </div>
          </>
        )}
      </div>

      {confirmCobro && comanda && (
        <ModalPago
          total={comanda.total}
          titulo="Cobrar mesa"
          onConfirmar={cobrarComanda}
          onCancelar={() => setConfirmCobro(false)}
          procesando={procesando}
        />
      )}
      </PlanGuard>
    </RouteGuard>
  )
}
