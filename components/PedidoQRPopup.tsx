'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type PedidoQR } from '@/context/PedidosQRContext'

interface Props {
  pedido: PedidoQR
  onCerrar: () => void
}

export function PedidoQRPopup({ pedido, onCerrar }: Props) {
  const router = useRouter()

  // Auto-cierre a los 8 segundos
  useEffect(() => {
    const t = setTimeout(onCerrar, 8000)
    return () => clearTimeout(t)
  }, [onCerrar])

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-gray-900 border border-violet-600 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
      {/* Barra de progreso */}
      <div className="h-1 bg-violet-600 animate-shrink-bar" />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <div>
              <p className="text-sm font-bold text-white">Nuevo pedido QR</p>
              <p className="text-xs text-violet-400">{pedido.mesa_nombre}</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-gray-500 hover:text-white transition text-lg leading-none mt-0.5">×</button>
        </div>

        <div className="space-y-1 mb-3">
          {pedido.items.slice(0, 3).map((item, i) => (
            <p key={i} className="text-xs text-gray-300">
              <span className="font-semibold">{item.cantidad}×</span> {item.nombre}
              {item.observacion && <span className="text-amber-400 italic"> — {item.observacion}</span>}
            </p>
          ))}
          {pedido.items.length > 3 && (
            <p className="text-xs text-gray-500">+{pedido.items.length - 3} más...</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">${pedido.total.toLocaleString()}</span>
          <button
            onClick={() => { router.push('/pedidos'); onCerrar() }}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
          >
            Ver pedido →
          </button>
        </div>
      </div>
    </div>
  )
}
