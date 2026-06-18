'use client'
import { Sidebar } from '@/components/Sidebar'
import { PedidoQRPopup } from '@/components/PedidoQRPopup'
import { PedidosQRProvider, usePedidosQR } from '@/context/PedidosQRContext'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { nuevoPedido, cerrarNuevo } = usePedidosQR()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
        {children}
      </main>
      {nuevoPedido && <PedidoQRPopup pedido={nuevoPedido} onCerrar={cerrarNuevo} />}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PedidosQRProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </PedidosQRProvider>
  )
}
