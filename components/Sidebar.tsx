'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/lib/sessionStore'
import { usePermisos } from '@/hooks/usePermisos'
import { supabaseApp } from '@/lib/supabaseApp'
import { DemoBanner } from './DemoBanner'
import { usePedidosQR } from '@/context/PedidosQRContext'

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',    emoji: '📊', permiso: 'verDashboard' },
  { href: '/ventas',        label: 'Ventas',       emoji: '💰', permiso: 'verVentas' },
  { href: '/mesas',         label: 'Mesas',        emoji: '🪑', permiso: 'verMesas' },
  { href: '/pedidos',       label: 'Pedidos QR',   emoji: '📋', permiso: 'verComandas' },
  { href: '/cocina',        label: 'Cocina',       emoji: '👨‍🍳', permiso: 'verCocina' },
  { href: '/productos',     label: 'Productos',    emoji: '🍔', permiso: 'verProductos' },
  { href: '/clientes',      label: 'Clientes',     emoji: '👥', permiso: 'verClientes' },
  { href: '/caja',          label: 'Caja',         emoji: '🏧', permiso: 'verCaja' },
  { href: '/reportes',      label: 'Reportes',     emoji: '📈', permiso: 'verReportes' },
  { href: '/configuracion', label: 'Configuración',emoji: '⚙️', permiso: 'verConfig' },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const { nombreNegocio, rolSistema } = useSession()
  const permisos = usePermisos()
  const { total: pedidosPendientes } = usePedidosQR()

  const handleLogout = async () => {
    await supabaseApp.auth.signOut()
  }

  const items = NAV_ITEMS.filter((item) => permisos[item.permiso as keyof typeof permisos])

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      <DemoBanner />

      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-lg">🍽️</div>
          <div>
            <p className="text-sm font-bold text-white truncate max-w-[140px]">
              {nombreNegocio || 'GastroApp'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{rolSistema}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const badge = item.href === '/pedidos' && pedidosPendientes > 0 ? pedidosPendientes : null

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <span className="text-base">{item.emoji}</span>
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <span className="text-base">🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
