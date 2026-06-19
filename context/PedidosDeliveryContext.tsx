'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

export interface PedidoDeliveryNotif {
  id: string
  cliente_nombre: string
  cliente_dir: string
  total: number
  origen: 'link' | 'manual'
  created_at: string
}

interface PedidosDeliveryCtx {
  nuevoPedido: PedidoDeliveryNotif | null
  cerrarNuevo: () => void
  totalPendientes: number
}

const Ctx = createContext<PedidosDeliveryCtx>({
  nuevoPedido: null,
  cerrarNuevo: () => {},
  totalPendientes: 0,
})

export function PedidosDeliveryProvider({ children }: { children: ReactNode }) {
  const { localId } = useSession()
  const [nuevoPedido, setNuevoPedido] = useState<PedidoDeliveryNotif | null>(null)
  const [totalPendientes, setTotalPendientes] = useState(0)

  const cargarTotal = useCallback(async () => {
    if (!localId) return
    const { count } = await supabaseApp
      .from('pedidos_delivery')
      .select('id', { count: 'exact', head: true })
      .eq('local_id', localId)
      .eq('estado', 'recibido')
    setTotalPendientes(count ?? 0)
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargarTotal()

    const channel = supabaseApp
      .channel('pedidos-delivery-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_delivery' },
        (payload) => {
          const nuevo = payload.new as PedidoDeliveryNotif
          // Solo notificar si viene del link público (manual ya lo ve quien lo cargó)
          if (nuevo.origen === 'link') {
            setNuevoPedido(nuevo)
            try {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.setValueAtTime(660, ctx.currentTime)
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
              osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.3)
              gain.gain.setValueAtTime(0.3, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
              osc.start(ctx.currentTime)
              osc.stop(ctx.currentTime + 0.5)
            } catch { /* browser bloqueó audio */ }
          }
          cargarTotal()
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos_delivery' },
        () => cargarTotal()
      )
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, cargarTotal])

  return (
    <Ctx.Provider value={{ nuevoPedido, cerrarNuevo: () => setNuevoPedido(null), totalPendientes }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePedidosDelivery() {
  return useContext(Ctx)
}
