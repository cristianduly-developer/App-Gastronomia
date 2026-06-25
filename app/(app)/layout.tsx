'use client'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'
import { PedidoQRPopup } from '@/components/PedidoQRPopup'
import { PedidoDeliveryPopup } from '@/components/PedidoDeliveryPopup'
import { ItemListoPopup } from '@/components/ItemListoPopup'
import { AppRealtimeProvider, usePedidosQR, usePedidosDelivery } from '@/context/AppRealtimeContext'
import { useSessionGuard } from '@/hooks/useSessionGuard'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  useSessionGuard()
  const { nuevoPedido: nuevoQR, cerrarNuevo: cerrarQR } = usePedidosQR()
  const { nuevoPedido: nuevoDelivery, cerrarNuevo: cerrarDelivery } = usePedidosDelivery()

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
