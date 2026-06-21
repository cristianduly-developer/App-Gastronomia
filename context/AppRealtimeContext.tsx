'use client'
import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PedidoDeliveryNotif {
  id: string
  cliente_nombre: string
  cliente_dir: string
  total: number
  origen: 'link' | 'manual'
  created_at: string
}

export interface PedidoQR {
  id: string
  mesa_nombre: string
  items: { nombre: string; cantidad: number; observacion: string | null }[]
  total: number
  created_at: string
}

interface ItemListo {
  id: string
  nombre: string
  cantidad: number
  mesa_nombre: string
  comanda_id: string
}

// ── Contexto unificado ────────────────────────────────────────────────────────

interface AppRealtimeCtx {
  // Delivery
  nuevoDelivery: PedidoDeliveryNotif | null
  cerrarDelivery: () => void
  totalDeliveryPendientes: number
  // QR
  pendientesQR: PedidoQR[]
  nuevoQR: PedidoQR | null
  cerrarQR: () => void
  totalQR: number
  // Items listos (mozo)
  nuevoListo: ItemListo | null
  cerrarListo: () => void
}

const Ctx = createContext<AppRealtimeCtx>({
  nuevoDelivery: null, cerrarDelivery: () => {}, totalDeliveryPendientes: 0,
  pendientesQR: [], nuevoQR: null, cerrarQR: () => {}, totalQR: 0,
  nuevoListo: null, cerrarListo: () => {},
})

export function AppRealtimeProvider({ children }: { children: ReactNode }) {
  const { localId, rolSistema, mesasAsignadas } = useSession()

  // Delivery
  const [nuevoDelivery, setNuevoDelivery] = useState<PedidoDeliveryNotif | null>(null)
  const [totalDeliveryPendientes, setTotalDeliveryPendientes] = useState(0)

  // QR
  const [pendientesQR, setPendientesQR] = useState<PedidoQR[]>([])
  const [nuevoQR, setNuevoQR] = useState<PedidoQR | null>(null)

  // Items listos
  const [nuevoListo, setNuevoListo] = useState<ItemListo | null>(null)

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null)

  const tocar = (frecuencias: number[]) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      frecuencias.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.4)
      })
    } catch {}
  }

  const cargarTotalDelivery = useCallback(async () => {
    if (!localId) return
    const { count } = await supabaseApp
      .from('pedidos_delivery')
      .select('id', { count: 'exact', head: true })
      .eq('local_id', localId)
      .eq('estado', 'recibido')
    setTotalDeliveryPendientes(count ?? 0)
  }, [localId])

  const cargarQR = useCallback(async () => {
    if (!localId) return
    const { data } = await supabaseApp
      .from('pedidos_qr')
      .select('id, mesa_nombre, items, total, created_at')
      .eq('local_id', localId)
      .eq('estado', 'pendiente')
      .order('created_at')
    setPendientesQR(data ?? [])
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargarTotalDelivery()
    cargarQR()

    // Canal único para todas las notificaciones en tiempo real
    const channel = supabaseApp
      .channel('app-realtime')

      // Delivery — nuevo pedido del link público
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_delivery', filter: `local_id=eq.${localId}` },
        (payload) => {
          const nuevo = payload.new as PedidoDeliveryNotif
          if (nuevo.origen === 'link') {
            setNuevoDelivery(nuevo)
            tocar([660, 880, 1100])
          }
          cargarTotalDelivery()
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos_delivery', filter: `local_id=eq.${localId}` },
        () => cargarTotalDelivery()
      )

      // QR — pedido desde la carta
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_qr', filter: `local_id=eq.${localId}` },
        (payload) => {
          const nuevo = payload.new as PedidoQR
          setPendientesQR((prev) => [...prev, nuevo])
          setNuevoQR(nuevo)
          tocar([880, 660])
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos_qr', filter: `local_id=eq.${localId}` },
        () => cargarQR()
      )

    // Items listos — solo para mozos
    if (rolSistema === 'mozo') {
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_comanda', filter: `local_id=eq.${localId}` },
        async (payload) => {
          const item = payload.new as any
          if (item.estado !== 'listo') return
          const { data: comanda } = await supabaseApp
            .from('comandas')
            .select('mesa_id, mesas!inner(nombre)')
            .eq('id', item.comanda_id)
            .maybeSingle()
          if (!comanda) return
          if (mesasAsignadas && mesasAsignadas.length > 0 && !mesasAsignadas.includes(comanda.mesa_id)) return
          setNuevoListo({
            id: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            mesa_nombre: (comanda.mesas as any)?.nombre ?? '?',
            comanda_id: item.comanda_id,
          })
          tocar([880, 1100])
        }
      )
    }

    channel.subscribe()
    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, rolSistema, mesasAsignadas])

  return (
    <Ctx.Provider value={{
      nuevoDelivery, cerrarDelivery: () => setNuevoDelivery(null), totalDeliveryPendientes,
      pendientesQR, nuevoQR, cerrarQR: () => setNuevoQR(null), totalQR: pendientesQR.length,
      nuevoListo, cerrarListo: () => setNuevoListo(null),
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAppRealtime() { return useContext(Ctx) }

// Hooks de compatibilidad para componentes existentes
export function usePedidosDelivery() {
  const { nuevoDelivery, cerrarDelivery, totalDeliveryPendientes } = useAppRealtime()
  return { nuevoPedido: nuevoDelivery, cerrarNuevo: cerrarDelivery, totalPendientes: totalDeliveryPendientes }
}

export function usePedidosQR() {
  const { pendientesQR, nuevoQR, cerrarQR, totalQR } = useAppRealtime()
  return { pendientes: pendientesQR, nuevoPedido: nuevoQR, cerrarNuevo: cerrarQR, total: totalQR }
}

export function useItemsListos() {
  const { nuevoListo, cerrarListo } = useAppRealtime()
  return { nuevoListo, cerrar: cerrarListo }
}
