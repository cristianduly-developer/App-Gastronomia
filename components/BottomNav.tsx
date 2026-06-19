'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/lib/sessionStore'
import { usePermisos } from '@/hooks/usePermisos'
import { supabaseApp } from '@/lib/supabaseApp'
import { usePedidosQR } from '@/context/PedidosQRContext'
import { usePedidosDelivery } from '@/context/PedidosDeliveryContext'

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',    emoji: '📊', permiso: 'verDashboard',    config: null },
  { href: '/ventas',        label: 'Ventas',       emoji: '💰', permiso: 'verVentas',        config: null },
  { href: '/mesas',         label: 'Mesas',        emoji: '🪑', permiso: 'verMesas',         config: 'usaMesas' },
  { href: '/pedidos',       label: 'Pedidos QR',   emoji: '📋', permiso: 'verComandas',      config: 'usaQr' },
  { href: '/cocina',        label: 'Cocina',       emoji: '👨‍🍳', permiso: 'verCocina',        config: 'usaCocina' },
  { href: '/delivery',      label: 'Delivery',     emoji: '🛵', permiso: 'verDelivery',      config: 'usaDelivery' },
  { href: '/productos',     label: 'Productos',    emoji: '🍔', permiso: 'verProductos',     config: null },
  { href: '/clientes',      label: 'Clientes',     emoji: '👥', permiso: 'verClientes',      config: null },
  { href: '/caja',          label: 'Caja',         emoji: '🏧', permiso: 'verCaja',          config: null },
  { href: '/reportes',      label: 'Reportes',     emoji: '📈', permiso: 'verReportes',      config: null },
  { href: '/colaboradores', label: 'Colaboradores',emoji: '👥', permiso: 'verColaboradores', config: null },
  { href: '/configuracion', label: 'Config',       emoji: '⚙️', permiso: 'verConfig',        config: null },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { usaMesas, usaDelivery, usaCocina, usaQr } = useSession()
  const permisos = usePermisos()
  const { total: pedidosPendientes } = usePedidosQR()
  const { totalPendientes: deliveryPendientes } = usePedidosDelivery()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const configFlags: Record<string, boolean> = { usaMesas, usaDelivery, usaCocina, usaQr }

  const items = NAV_ITEMS.filter((item) =>
    permisos[item.permiso as keyof typeof permisos] &&
    (item.config === null || configFlags[item.config])
  )

  const principales = items.slice(0, 4)
  const resto = items.slice(4)

  const getBadge = (href: string) => {
    if (href === '/pedidos' && pedidosPendientes > 0) return pedidosPendientes
    if (href === '/delivery' && deliveryPendientes > 0) return deliveryPendientes
    return null
  }

  return (
    <>
      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 md:hidden">
        <div className="flex items-stretch h-16">
          {principales.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const badge = getBadge(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors
                  ${active ? 'text-violet-400' : 'text-gray-500'}`}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {badge && (
                  <span className="absolute top-2 right-1/4 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-violet-500 rounded-full" />}
              </Link>
            )
          })}

          {resto.length > 0 && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-500"
            >
              <span className="text-xl leading-none">☰</span>
              <span className="text-[10px] font-medium leading-none">Más</span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer "Más" */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />

          {/* Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-gray-800 pb-safe">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">Menú</span>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            <div className="p-3 space-y-0.5">
              {resto.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = getBadge(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition
                      ${active ? 'bg-violet-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span className="flex-1">{item.label}</span>
                    {badge && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="px-3 pb-4 border-t border-gray-800 pt-3">
              <button
                onClick={() => supabaseApp.auth.signOut()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 transition"
              >
                <span className="text-lg">🚪</span>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
