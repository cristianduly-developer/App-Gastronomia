'use client'
import { Sidebar } from '@/components/Sidebar'
import { PedidoQRPopup } from '@/components/PedidoQRPopup'
import { PedidoDeliveryPopup } from '@/components/PedidoDeliveryPopup'
import { PedidosQRProvider, usePedidosQR } from '@/context/PedidosQRContext'
import { PedidosDeliveryProvider, usePedidosDelivery } from '@/context/PedidosDeliveryContext'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { nuevoPedido: nuevoQR, cerrarNuevo: cerrarQR } = usePedidosQR()
  const { nuevoPedido: nuevoDelivery, cerrarNuevo: cerrarDelivery } = usePedidosDelivery()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
        {children}
      </main>
      {nuevoQR && <PedidoQRPopup pedido={nuevoQR} onCerrar={cerrarQR} />}
      {nuevoDelivery && <PedidoDeliveryPopup pedido={nuevoDelivery} onCerrar={cerrarDelivery} />}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PedidosQRProvider>
      <PedidosDeliveryProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </PedidosDeliveryProvider>
    </PedidosQRProvider>
  )
}
