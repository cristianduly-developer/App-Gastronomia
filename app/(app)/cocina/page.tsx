'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null)
  const [activo, setActivo] = useState(false)

  const activar = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      lockRef.current = await (navigator as any).wakeLock.request('screen')
      setActivo(true)
      lockRef.current?.addEventListener('release', () => setActivo(false))
    } catch { /* navegador no lo permite */ }
  }, [])

  const desactivar = useCallback(() => {
    lockRef.current?.release()
    lockRef.current = null
    setActivo(false)
  }, [])

  // Re-activar si la página vuelve al foco (ej: el user cambia de tab y vuelve)
  useEffect(() => {
    const handler = () => { if (activo) activar() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [activo, activar])

  return { activo, activar, desactivar }
}

interface ItemCocina {
  id: string
  nombre: string
  cantidad: number
  observacion: string | null
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
  tanda: number
  created_at: string
  comanda_id: string
  mesa_nombre: string
  origen: 'mesa' | 'delivery'
  pedido_delivery_id?: string
}

const COLUMNAS = [
  { key: 'pendiente',      label: 'Pendiente',      color: 'border-yellow-600', badge: 'bg-yellow-900 text-yellow-300', dot: 'bg-yellow-500' },
  { key: 'en_preparacion', label: 'En preparación', color: 'border-blue-600',   badge: 'bg-blue-900 text-blue-300',     dot: 'bg-blue-500' },
  { key: 'listo',          label: 'Listo ✓',        color: 'border-green-600',  badge: 'bg-green-900 text-green-300',   dot: 'bg-green-500' },
] as const

type EstadoColumna = typeof COLUMNAS[number]['key']

function tiempoEspera(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

function colorTiempo(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 10) return 'text-gray-500'
  if (mins < 20) return 'text-yellow-400'
  return 'text-red-400'
}

export default function CocinaPage() {
  const { localId } = useSession()
  const [items, setItems] = useState<ItemCocina[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [cambiando, setCambiando] = useState<Set<string>>(new Set())
  const { activo: wakeLockActivo, activar: activarWakeLock, desactivar: desactivarWakeLock } = useWakeLock()

  const cargarItems = useCallback(async () => {
    const [{ data: itemsMesa }, { data: itemsDelivery }] = await Promise.all([
      supabaseApp
        .from('items_comanda')
        .select(`id, nombre, cantidad, observacion, estado, tanda, created_at, comanda_id, comandas!inner ( mesa_id, mesas!inner ( nombre ) )`)
        .eq('comandas.local_id', localId)
        .in('estado', ['pendiente', 'en_preparacion', 'listo'])
        .order('created_at'),
      supabaseApp
        .from('items_pedido_delivery')
        .select(`id, nombre, cantidad, observacion, created_at, pedido_delivery_id, pedidos_delivery!inner ( local_id, cliente_nombre, estado )`)
        .eq('pedidos_delivery.local_id', localId)
        .eq('pedidos_delivery.estado', 'en_cocina')
        .order('created_at'),
    ])

    const deMesa: ItemCocina[] = (itemsMesa ?? []).map((i: any) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      observacion: i.observacion,
      estado: i.estado,
      tanda: i.tanda,
      created_at: i.created_at,
      comanda_id: i.comanda_id,
      mesa_nombre: i.comandas?.mesas?.nombre ?? '?',
      origen: 'mesa' as const,
    }))

    const deDelivery: ItemCocina[] = (itemsDelivery ?? []).map((i: any) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      observacion: i.observacion,
      estado: 'pendiente' as const,
      tanda: 1,
      created_at: i.created_at,
      comanda_id: '',
      mesa_nombre: i.pedidos_delivery?.cliente_nombre ?? 'Delivery',
      origen: 'delivery' as const,
      pedido_delivery_id: i.pedido_delivery_id,
    }))

    setItems([...deMesa, ...deDelivery].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    setLoading(false)
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargarItems()

    const channel = supabaseApp
      .channel('cocina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_comanda' }, cargarItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_delivery' }, cargarItems)
      .subscribe()

    // Tick cada minuto para actualizar los tiempos
    const interval = setInterval(() => setTick((t) => t + 1), 60000)

    return () => {
      supabaseApp.removeChannel(channel)
      clearInterval(interval)
    }
  }, [localId, cargarItems])

  const avanzarEstado = async (item: ItemCocina) => {
    const siguiente: Record<EstadoColumna, string> = {
      pendiente:      'en_preparacion',
      en_preparacion: 'listo',
      listo:          'entregado',
    }
    const nuevoEstado = siguiente[item.estado as EstadoColumna]
    if (!nuevoEstado) return

    setCambiando((s) => new Set(s).add(item.id))

    if (item.origen === 'delivery') {
      // Items de delivery: cuando llegan a "listo" desaparecen de cocina
      // (el estado del pedido lo maneja el panel de delivery)
      if (nuevoEstado === 'entregado' || nuevoEstado === 'listo') {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      } else {
        setItems((prev) =>
          prev.map((i) => i.id === item.id ? { ...i, estado: nuevoEstado as ItemCocina['estado'] } : i)
        )
      }
    } else {
      await supabaseApp
        .from('items_comanda')
        .update({ estado: nuevoEstado })
        .eq('id', item.id)

      if (nuevoEstado === 'entregado') {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      } else {
        setItems((prev) =>
          prev.map((i) => i.id === item.id ? { ...i, estado: nuevoEstado as ItemCocina['estado'] } : i)
        )
      }
    }

    setCambiando((s) => { const ns = new Set(s); ns.delete(item.id); return ns })
  }

  const itemsPorEstado = (estado: EstadoColumna) =>
    items.filter((i) => i.estado === estado)

  const SIGUIENTE_LABEL: Record<EstadoColumna, string> = {
    pendiente:      'Iniciar',
    en_preparacion: 'Listo',
    listo:          'Entregado',
  }

  return (
    <RouteGuard permiso="verCocina">
      <PlanGuard feature="usaCocina">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-white">Monitor de cocina</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400">En tiempo real</span>
            </div>
            <button
              onClick={wakeLockActivo ? desactivarWakeLock : activarWakeLock}
              title={wakeLockActivo ? 'Desactivar pantalla siempre activa' : 'Mantener pantalla encendida'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition
                ${wakeLockActivo
                  ? 'bg-green-900 text-green-300 border border-green-700'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
            >
              {wakeLockActivo ? '☀️ Pantalla activa' : '💤 Mantener pantalla'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <p className="text-5xl mb-4">👨‍🍳</p>
              <p className="text-lg font-medium text-gray-400">Sin pedidos pendientes</p>
              <p className="text-sm mt-1">Los nuevos pedidos aparecen acá automáticamente</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
            {COLUMNAS.map((col) => {
              const colItems = itemsPorEstado(col.key)
              return (
                <div key={col.key} className={`flex flex-col border-t-2 ${col.color} bg-gray-900/50 rounded-2xl overflow-hidden`}>
                  {/* Header columna */}
                  <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-sm font-semibold text-white">{col.label}</span>
                    </div>
                    {colItems.length > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${col.badge}`}>
                        {colItems.length}
                      </span>
                    )}
                  </div>

                  {/* Items */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {colItems.length === 0 ? (
                      <p className="text-gray-700 text-sm text-center py-6">—</p>
                    ) : (
                      colItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2"
                        >
                          {/* Origen + tanda */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {item.origen === 'delivery' && <span className="text-xs">🛵</span>}
                              <span className={`text-xs font-bold ${item.origen === 'delivery' ? 'text-orange-400' : 'text-violet-400'}`}>
                                {item.mesa_nombre}
                              </span>
                            </div>
                            {item.origen === 'mesa' && <span className="text-xs text-gray-600">T{item.tanda}</span>}
                          </div>

                          {/* Producto */}
                          <div className="flex items-start gap-2">
                            <span className="text-lg font-black text-white leading-none">{item.cantidad}×</span>
                            <span className="text-sm font-semibold text-white leading-snug">{item.nombre}</span>
                          </div>

                          {/* Observación */}
                          {item.observacion && (
                            <p className="text-xs text-amber-400 bg-amber-950/30 rounded-lg px-2 py-1 italic">
                              {item.observacion}
                            </p>
                          )}

                          {/* Tiempo + acción */}
                          <div className="flex items-center justify-between pt-1">
                            <span className={`text-xs font-medium ${colorTiempo(item.created_at)}`} suppressHydrationWarning>
                              {tiempoEspera(item.created_at)}
                            </span>
                            <button
                              onClick={() => avanzarEstado(item)}
                              disabled={cambiando.has(item.id)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40
                                ${col.key === 'pendiente'      ? 'bg-blue-600 hover:bg-blue-500 text-white' : ''}
                                ${col.key === 'en_preparacion' ? 'bg-green-600 hover:bg-green-500 text-white' : ''}
                                ${col.key === 'listo'          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : ''}
                              `}
                            >
                              {cambiando.has(item.id) ? '...' : SIGUIENTE_LABEL[col.key]}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </PlanGuard>
    </RouteGuard>
  )
}
