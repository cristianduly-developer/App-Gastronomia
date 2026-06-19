'use client'
import { Sidebar } from '@/components/Sidebar'
import { PedidoQRPopup } from '@/components/PedidoQRPopup'
import { PedidoDeliveryPopup } from '@/components/PedidoDeliveryPopup'
import { ItemListoPopup } from '@/components/ItemListoPopup'
import { PedidosQRProvider, usePedidosQR } from '@/context/PedidosQRContext'
import { PedidosDeliveryProvider, usePedidosDelivery } from '@/context/PedidosDeliveryContext'
import { ItemsListosProvider } from '@/context/ItemsListosContext'

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
      <ItemListoPopup />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PedidosQRProvider>
      <PedidosDeliveryProvider>
        <ItemsListosProvider>
          <AppLayoutInner>{children}</AppLayoutInner>
        </ItemsListosProvider>
      </PedidosDeliveryProvider>
    </PedidosQRProvider>
  )
}
