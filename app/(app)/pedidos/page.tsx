'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface ItemQR {
  producto_id: string
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
  observacion: string | null
}

interface PedidoQR {
  id: string
  mesa_id: string
  mesa_nombre: string
  items: ItemQR[]
  total: number
  estado: 'pendiente' | 'aceptado' | 'rechazado'
  created_at: string
}

function tiempoEspera(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function PedidosQRPage() {
  const { localId, usaCocina } = useSession()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoQR[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<Set<string>>(new Set())
  const [autoAceptar, setAutoAceptar] = useState(false)
  const autoAceptarRef = useRef(false)

  useEffect(() => { autoAceptarRef.current = autoAceptar }, [autoAceptar])

  const cargar = useCallback(async () => {
    const { data } = await supabaseApp
      .from('pedidos_qr')
      .select('*')
      .eq('local_id', localId)
      .eq('estado', 'pendiente')
      .order('created_at')
    setPedidos(data ?? [])
    setLoading(false)
  }, [localId])

  useEffect(() => {
    if (!localId) return
    supabaseApp.from('config_local').select('qr_auto_aceptar').eq('local_id', localId).single()
      .then(({ data }) => { if (data) setAutoAceptar(data.qr_auto_aceptar ?? false) })
    cargar()

    const channel = supabaseApp
      .channel('pedidos-qr-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_qr', filter: `local_id=eq.${localId}` }, (payload) => {
        if (autoAceptarRef.current) {
          aceptar(payload.new as PedidoQR)
        } else {
          cargar()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos_qr', filter: `local_id=eq.${localId}` }, cargar)
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, cargar])

  const aceptar = async (pedido: PedidoQR) => {
    setProcesando((s) => new Set(s).add(pedido.id))

    // 1. Buscar comanda abierta de esa mesa o crear una nueva
    const { data: comandaExistente } = await supabaseApp
      .from('comandas')
      .select('id, tanda_actual')
      .eq('mesa_id', pedido.mesa_id)
      .eq('estado', 'abierta')
      .maybeSingle()

    let comandaId = comandaExistente?.id
    let tanda = (comandaExistente?.tanda_actual ?? 0) + 1

    if (!comandaId) {
      const { data: nueva } = await supabaseApp
        .from('comandas')
        .insert({ local_id: localId, mesa_id: pedido.mesa_id, tanda_actual: 1, total: 0 })
        .select('id')
        .single()
      comandaId = nueva?.id
      tanda = 1
      await supabaseApp.from('mesas').update({ estado: 'ocupada' }).eq('id', pedido.mesa_id)
    } else {
      await supabaseApp.from('comandas').update({ tanda_actual: tanda }).eq('id', comandaId)
    }

    if (!comandaId) {
      setProcesando((s) => { const n = new Set(s); n.delete(pedido.id); return n })
      return
    }

    // 2. Insertar items en comanda
    const items = pedido.items.map((i) => ({
      comanda_id: comandaId,
      local_id: localId,
      producto_id: i.producto_id,
      nombre: i.nombre,
      precio: i.precio,
      precio_unitario: i.precio,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      observacion: i.observacion,
      tanda,
      estado: usaCocina ? 'pendiente' : 'listo',
    }))
    await supabaseApp.from('items_comanda').insert(items)

    // 3. Recalcular total comanda
    const { data: todosItems } = await supabaseApp
      .from('items_comanda')
      .select('subtotal')
      .eq('comanda_id', comandaId)
    const nuevoTotal = (todosItems ?? []).reduce((s, i) => s + Number(i.subtotal), 0)
    await supabaseApp.from('comandas').update({ total: nuevoTotal }).eq('id', comandaId)

    // 4. Marcar pedido QR como aceptado
    await supabaseApp.from('pedidos_qr').update({ estado: 'aceptado' }).eq('id', pedido.id)

    setPedidos((prev) => prev.filter((p) => p.id !== pedido.id))
    setProcesando((s) => { const n = new Set(s); n.delete(pedido.id); return n })
  }

  const rechazar = async (id: string) => {
    setProcesando((s) => new Set(s).add(id))
    await supabaseApp.from('pedidos_qr').update({ estado: 'rechazado' }).eq('id', id)
    setPedidos((prev) => prev.filter((p) => p.id !== id))
    setProcesando((s) => { const n = new Set(s); n.delete(id); return n })
  }

  return (
    <RouteGuard permiso="verComandas">
      <PlanGuard feature="usaQrPedido">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pedidos QR</h1>
            <p className="text-xs text-gray-400 mt-0.5">Pedidos enviados por los clientes desde la mesa</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-400">En tiempo real</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">📱</p>
            <p className="text-lg font-medium text-gray-400">Sin pedidos pendientes</p>
            <p className="text-sm mt-1">Los pedidos de los clientes aparecen acá automáticamente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="bg-gray-900 border border-violet-800 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-violet-950/40">
                  <div>
                    <span className="font-bold text-white">{pedido.mesa_nombre}</span>
                    <span className="text-xs text-gray-400 ml-3">{tiempoEspera(pedido.created_at)}</span>
                  </div>
                  <span className="text-sm font-bold text-violet-300">${pedido.total.toLocaleString()}</span>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-800">
                  {pedido.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-3">
                      <span className="text-base font-black text-white">{item.cantidad}×</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{item.nombre}</p>
                        {item.observacion && (
                          <p className="text-xs text-amber-400 italic mt-0.5">{item.observacion}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">${item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Acciones */}
                <div className="flex gap-3 px-5 py-4 border-t border-gray-800">
                  <button
                    onClick={() => rechazar(pedido.id)}
                    disabled={procesando.has(pedido.id)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 font-semibold rounded-xl py-3 text-sm transition"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => aceptar(pedido)}
                    disabled={procesando.has(pedido.id)}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                  >
                    {procesando.has(pedido.id) ? 'Procesando...' : 'Aceptar → Comanda'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </PlanGuard>
    </RouteGuard>
  )
}
