'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Stats {
  ventasHoy: number
  ticketPromedio: number
  mesasOcupadas: number
  totalMesas: number
  pedidosPendientes: number
  cajaAbierta: boolean
}

export default function DashboardPage() {
  const { localId, nombreNegocio, nombreUsuario, usaMesas, usaCocina, usaDelivery, usaQr } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localId) return
    cargarStats()

    const onFocus = () => cargarStats()
    const onVisible = () => { if (document.visibilityState === 'visible') cargarStats() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabaseApp
      .channel('dashboard-caja')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja', filter: `local_id=eq.${localId}` }, cargarStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: `local_id=eq.${localId}` }, cargarStats)
      .subscribe()

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      supabaseApp.removeChannel(channel)
    }
  }, [localId])

  const cargarStats = async () => {
    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    const [
      { data: ventas },
      { data: mesas },
      { data: items },
      { data: caja },
    ] = await Promise.all([
      supabaseApp
        .from('ventas')
        .select('total')
        .eq('local_id', localId)
        .gte('created_at', hoyInicio.toISOString()),
      supabaseApp
        .from('mesas')
        .select('estado')
        .eq('local_id', localId)
        .eq('activo', true),
      supabaseApp
        .from('items_comanda')
        .select('id, comandas!inner(local_id)')
        .eq('comandas.local_id', localId)
        .in('estado', ['pendiente', 'en_preparacion']),
      supabaseApp
        .from('caja')
        .select('id')
        .eq('local_id', localId)
        .eq('estado', 'abierta')
        .maybeSingle(),
    ])

    const totalVentas = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0)
    const cantVentas = ventas?.length ?? 0
    const mesasOcupadas = (mesas ?? []).filter((m) => m.estado !== 'libre').length

    setStats({
      ventasHoy: totalVentas,
      ticketPromedio: cantVentas > 0 ? Math.round(totalVentas / cantVentas) : 0,
      mesasOcupadas,
      totalMesas: mesas?.length ?? 0,
      pedidosPendientes: items?.length ?? 0,
      cajaAbierta: !!caja,
    })
    setLoading(false)
  }

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <RouteGuard permiso="verDashboard">
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{saludo}, {nombreUsuario?.split(' ')[0] || 'bienvenido'} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">{nombreNegocio || 'GastroApp'} — resumen de hoy</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats && (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Ventas hoy"      value={`$${stats.ventasHoy.toLocaleString()}`}       emoji="💰" color="violet" />
              <MetricCard label="Ticket promedio" value={`$${stats.ticketPromedio.toLocaleString()}`}  emoji="🧾" color="blue" />
              {usaMesas && <MetricCard label="Mesas ocupadas"    value={`${stats.mesasOcupadas} / ${stats.totalMesas}`} emoji="🪑" color="green" />}
              {usaCocina && <MetricCard label="Pedidos en cocina" value={String(stats.pedidosPendientes)} emoji="👨‍🍳" color={stats.pedidosPendientes > 5 ? 'red' : 'gray'} />}
            </div>

            {/* Alertas */}
            {!stats.cajaAbierta && (
              <div className="bg-amber-950/40 border border-amber-800 rounded-2xl p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏧</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Caja sin abrir</p>
                    <p className="text-xs text-amber-500">Abrí la caja antes de empezar a vender</p>
                  </div>
                </div>
                <Link href="/caja" className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition">Abrir →</Link>
              </div>
            )}

            {usaCocina && stats.pedidosPendientes > 0 && (
              <div className="bg-blue-950/40 border border-blue-800 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-300">
                      {stats.pedidosPendientes} {stats.pedidosPendientes === 1 ? 'pedido pendiente' : 'pedidos pendientes'} en cocina
                    </p>
                    <p className="text-xs text-blue-500">Revisá el monitor de cocina</p>
                  </div>
                </div>
                <Link href="/cocina" className="text-xs font-semibold text-blue-300 hover:text-blue-200 transition">Ver →</Link>
              </div>
            )}

            {/* Accesos rápidos */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Accesos rápidos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { href: '/ventas',    emoji: '💰', label: 'Nueva venta',  show: true },
                  { href: '/mesas',     emoji: '🪑', label: 'Ver mesas',    show: usaMesas },
                  { href: '/cocina',    emoji: '👨‍🍳', label: 'Cocina',       show: usaCocina },
                  { href: '/delivery',  emoji: '🛵', label: 'Delivery',     show: usaDelivery },
                  { href: '/pedidos',   emoji: '📋', label: 'Pedidos QR',   show: usaQr },
                  { href: '/caja',      emoji: '🏧', label: 'Caja',         show: true },
                  { href: '/productos', emoji: '🍔', label: 'Productos',    show: true },
                  { href: '/clientes',  emoji: '👥', label: 'Clientes',     show: true },
                ].filter((a) => a.show).map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="bg-gray-900 border border-gray-800 hover:border-violet-600 rounded-2xl p-4 flex items-center gap-3 transition hover:scale-[1.02]"
                  >
                    <span className="text-2xl">{a.emoji}</span>
                    <span className="text-sm font-medium text-white">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  )
}

function MetricCard({ label, value, emoji, color }: { label: string; value: string; emoji: string; color: string }) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-950/50 border-violet-800',
    blue:   'bg-blue-950/50 border-blue-800',
    green:  'bg-green-950/50 border-green-800',
    red:    'bg-red-950/50 border-red-800',
    gray:   'bg-gray-900 border-gray-800',
  }
  return (
    <div className={`${colors[color] ?? colors.gray} border rounded-2xl p-4`}>
      <p className="text-2xl mb-2">{emoji}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
