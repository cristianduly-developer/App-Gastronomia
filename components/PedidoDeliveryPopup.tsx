'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PedidoDeliveryNotif } from '@/context/PedidosDeliveryContext'

interface Props {
  pedido: PedidoDeliveryNotif
  onCerrar: () => void
}

export function PedidoDeliveryPopup({ pedido, onCerrar }: Props) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onCerrar() }, 8000)
    return () => clearTimeout(t)
  }, [onCerrar])

  if (!visible) return null

  const esRetiro = pedido.cliente_dir === 'Retira en el local'

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-gray-900 border border-orange-700 rounded-2xl shadow-2xl p-4 w-80">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{esRetiro ? '🥡' : '🛵'}</span>
            <div>
              <p className="text-sm font-bold text-white">Nuevo pedido delivery</p>
              <p className="text-xs text-orange-400">{pedido.cliente_nombre}</p>
            </div>
          </div>
          <button onClick={() => { setVisible(false); onCerrar() }} className="text-gray-500 hover:text-white transition text-lg leading-none">✕</button>
        </div>

        <p className="text-xs text-gray-400 mb-1">
          {esRetiro ? '🥡 Retira en el local' : `📍 ${pedido.cliente_dir}`}
        </p>
        <p className="text-sm font-semibold text-white mb-3">${pedido.total.toLocaleString()}</p>

        <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-orange-500 rounded-full animate-shrink-bar" />
        </div>

        <button
          onClick={() => { router.push('/delivery'); setVisible(false); onCerrar() }}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm rounded-xl py-2 transition"
        >
          Ver pedido →
        </button>
      </div>
    </div>
  )
}
