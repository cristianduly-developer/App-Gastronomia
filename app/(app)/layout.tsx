'use client'
import { useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { PedidoQRPopup } from '@/components/PedidoQRPopup'
import { PedidoDeliveryPopup } from '@/components/PedidoDeliveryPopup'
import { ItemListoPopup } from '@/components/ItemListoPopup'
import { AppRealtimeProvider, usePedidosQR, usePedidosDelivery } from '@/context/AppRealtimeContext'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { nuevoPedido: nuevoQR, cerrarNuevo: cerrarQR } = usePedidosQR()
  const { nuevoPedido: nuevoDelivery, cerrarNuevo: cerrarDelivery } = usePedidosDelivery()
  const { localId, setSession } = useSession()

  useEffect(() => {
    if (!localId) return
    supabaseApp
      .from('config_local')
      .select('nombre_negocio, usa_mesas, usa_delivery, usa_cocina, usa_qr')
      .eq('local_id', localId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setSession({
          nombreNegocio: data.nombre_negocio ?? undefined,
          usaMesas:    data.usa_mesas    ?? false,
          usaDelivery: data.usa_delivery ?? false,
          usaCocina:   data.usa_cocina   ?? false,
          usaQr:       data.usa_qr       ?? false,
        })
      })
  }, [localId])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-6 pb-20 md:pb-6">
        {children}
      </main>
      <BottomNav />
      {nuevoQR && <PedidoQRPopup pedido={nuevoQR} onCerrar={cerrarQR} />}
      {nuevoDelivery && <PedidoDeliveryPopup pedido={nuevoDelivery} onCerrar={cerrarDelivery} />}
      <ItemListoPopup />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppRealtimeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppRealtimeProvider>
  )
}
