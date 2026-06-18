'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

export interface PedidoQR {
  id: string
  mesa_nombre: string
  items: { nombre: string; cantidad: number; observacion: string | null }[]
  total: number
  created_at: string
}

interface PedidosQRCtx {
  pendientes: PedidoQR[]
  nuevoPedido: PedidoQR | null
  cerrarNuevo: () => void
  total: number
}

const Ctx = createContext<PedidosQRCtx>({
  pendientes: [],
  nuevoPedido: null,
  cerrarNuevo: () => {},
  total: 0,
})

export function PedidosQRProvider({ children }: { children: ReactNode }) {
  const { localId } = useSession()
  const [pendientes, setPendientes] = useState<PedidoQR[]>([])
  const [nuevoPedido, setNuevoPedido] = useState<PedidoQR | null>(null)

  const cargar = useCallback(async () => {
    if (!localId) return
    const { data } = await supabaseApp
      .from('pedidos_qr')
      .select('id, mesa_nombre, items, total, created_at')
      .eq('local_id', localId)
      .eq('estado', 'pendiente')
      .order('created_at')
    setPendientes(data ?? [])
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargar()

    const channel = supabaseApp
      .channel('pedidos-qr-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_qr' },
        (payload) => {
          const nuevo = payload.new as PedidoQR
          setPendientes((prev) => [...prev, nuevo])
          setNuevoPedido(nuevo)
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.4)
          } catch { /* browser bloqueó audio */ }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos_qr' },
        () => cargar()
      )
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, cargar])

  return (
    <Ctx.Provider value={{
      pendientes,
      nuevoPedido,
      cerrarNuevo: () => setNuevoPedido(null),
      total: pendientes.length,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePedidosQR() {
  return useContext(Ctx)
}
