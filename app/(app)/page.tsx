'use client'
import { RouteGuard } from '@/components/RouteGuard'
import { useSession } from '@/lib/sessionStore'

export default function DashboardPage() {
  const { nombreNegocio } = useSession()

  return (
    <RouteGuard permiso="verDashboard">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-400 text-sm mb-8">
          Bienvenido{nombreNegocio ? ` a ${nombreNegocio}` : ''}
        </p>

        {/* Placeholder — se completa en Sprint 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Ventas hoy', value: '$0', emoji: '💰' },
            { label: 'Pedidos', value: '0', emoji: '📋' },
            { label: 'Ticket promedio', value: '$0', emoji: '🎫' },
            { label: 'Clientes', value: '0', emoji: '👥' },
          ].map((m) => (
            <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{m.label}</span>
                <span className="text-2xl">{m.emoji}</span>
              </div>
              <p className="text-2xl font-bold text-white">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center text-gray-500 text-sm">
          Las métricas reales se activan en Sprint 5 cuando haya ventas registradas
        </div>
      </div>
    </RouteGuard>
  )
}
