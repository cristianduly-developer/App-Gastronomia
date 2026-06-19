'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface ItemListo {
  id: string
  nombre: string
  cantidad: number
  mesa_nombre: string
  comanda_id: string
}

interface ItemsListosCtx {
  nuevoListo: ItemListo | null
  cerrar: () => void
}

const Ctx = createContext<ItemsListosCtx>({ nuevoListo: null, cerrar: () => {} })
export const useItemsListos = () => useContext(Ctx)

export function ItemsListosProvider({ children }: { children: React.ReactNode }) {
  const { localId, rolSistema, mesasAsignadas } = useSession()
  const [nuevoListo, setNuevoListo] = useState<ItemListo | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)

  const tocar = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext()
      const ctx = audioCtx.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }

  useEffect(() => {
    if (!localId || rolSistema !== 'mozo') return

    const channel = supabaseApp
      .channel('items-listos-mozo')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items_comanda', filter: `estado=eq.listo` },
        async (payload) => {
          const item = payload.new as any
          // Cargar mesa para verificar si le corresponde al mozo
          const { data: comanda } = await supabaseApp
            .from('comandas')
            .select('mesa_id, mesas!inner(nombre)')
            .eq('id', item.comanda_id)
            .maybeSingle()

          if (!comanda) return

          // Si el mozo tiene mesas asignadas, solo notificar las suyas
          if (mesasAsignadas && mesasAsignadas.length > 0 && !mesasAsignadas.includes(comanda.mesa_id)) return

          setNuevoListo({
            id: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            mesa_nombre: (comanda.mesas as any)?.nombre ?? '?',
            comanda_id: item.comanda_id,
          })
          tocar()
        }
      )
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId, rolSistema, mesasAsignadas])

  return (
    <Ctx.Provider value={{ nuevoListo, cerrar: () => setNuevoListo(null) }}>
      {children}
    </Ctx.Provider>
  )
}
