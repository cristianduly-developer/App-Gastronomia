'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Sector {
  id: string
  nombre: string
  orden: number
}

interface Mesa {
  id: string
  sector_id: string
  nombre: string
  capacidad: number
  estado: 'libre' | 'ocupada' | 'pidio_cuenta' | 'reservada'
  comanda?: { id: string; total: number; created_at: string }
}

const ESTADO_CONFIG = {
  libre:        { label: 'Libre',         color: 'border-gray-700 bg-gray-900',           badge: 'bg-green-900 text-green-400' },
  ocupada:      { label: 'Ocupada',       color: 'border-violet-600 bg-violet-950/30',    badge: 'bg-violet-900 text-violet-300' },
  pidio_cuenta: { label: 'Pidió cuenta',  color: 'border-amber-500 bg-amber-950/30',      badge: 'bg-amber-900 text-amber-300' },
  reservada:    { label: 'Reservada',     color: 'border-blue-600 bg-blue-950/30',        badge: 'bg-blue-900 text-blue-300' },
}

const FILTROS = ['Todas', 'Ocupadas', 'Libres', 'Cuenta'] as const
type Filtro = typeof FILTROS[number]

function tiempoOcupada(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function MesasPage() {
  const { localId, mesasAsignadas, rolSistema } = useSession()
  const router = useRouter()
  const [sectores, setSectores] = useState<Sector[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('Todas')

  useEffect(() => {
    if (!localId) return
    cargarDatos()

    // Realtime — actualizar estado de mesas
    const channel = supabaseApp
      .channel('mesas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, cargarDatos)
      .subscribe()

    return () => { supabaseApp.removeChannel(channel) }
  }, [localId])

  const cargarDatos = async () => {
    const [{ data: sects }, { data: mesasData }, { data: comandasData }] = await Promise.all([
      supabaseApp.from('sectores').select('*').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseApp.from('mesas').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('comandas').select('id, mesa_id, total, created_at').eq('local_id', localId).eq('estado', 'abierta'),
    ])

    const mesasConComanda = (mesasData ?? []).map((m) => ({
      ...m,
      comanda: (comandasData ?? []).find((c) => c.mesa_id === m.id),
    }))

    setSectores(sects ?? [])
    setMesas(mesasConComanda)
    setLoading(false)
  }

  // Si el mozo tiene mesas asignadas, filtrar solo las suyas
  const mesasVisibles = (rolSistema === 'mozo' && mesasAsignadas && mesasAsignadas.length > 0)
    ? mesas.filter((m) => mesasAsignadas.includes(m.id))
    : mesas

  const mesasFiltradas = mesasVisibles.filter((m) => {
    if (filtro === 'Todas') return true
    if (filtro === 'Ocupadas') return m.estado === 'ocupada'
    if (filtro === 'Libres') return m.estado === 'libre'
    if (filtro === 'Cuenta') return m.estado === 'pidio_cuenta'
    return true
  })

  const handleClickMesa = (mesa: Mesa) => {
    if (mesa.estado === 'libre') {
      // Abrir nueva comanda
      router.push(`/mesas/${mesa.id}/nueva-comanda`)
    } else {
      // Ver comanda existente
      router.push(`/mesas/${mesa.id}`)
    }
  }

  return (
    <RouteGuard permiso="verMesas">
      <PlanGuard feature="usaMesas">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Mesas</h1>
          <button
            onClick={() => router.push('/mesas/configurar')}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            ⚙️ Configurar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition
                ${filtro === f ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sectores.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🪑</p>
            <p className="mb-4">No hay sectores configurados</p>
            <button
              onClick={() => router.push('/mesas/configurar')}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition"
            >
              Configurar mesas
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sectores.map((sector) => {
              const mesasSector = mesasFiltradas.filter((m) => m.sector_id === sector.id)
              if (mesasSector.length === 0 && filtro !== 'Todas') return null
              return (
                <div key={sector.id}>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {sector.nombre}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {mesasSector.length === 0 ? (
                      <p className="col-span-full text-gray-600 text-sm">No hay mesas en este sector</p>
                    ) : (
                      mesasSector.map((mesa) => {
                        const cfg = ESTADO_CONFIG[mesa.estado]
                        return (
                          <button
                            key={mesa.id}
                            onClick={() => handleClickMesa(mesa)}
                            className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition hover:scale-[1.02] active:scale-[0.98] ${cfg.color}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-bold text-white text-sm">{mesa.nombre}</span>
                              <span className="text-xs text-gray-500">{mesa.capacidad} pers.</span>
                            </div>

                            <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${cfg.badge}`}>
                              {cfg.label}
                            </span>

                            {mesa.comanda && (
                              <>
                                <p className="text-lg font-bold text-white">
                                  ${mesa.comanda.total.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {tiempoOcupada(mesa.comanda.created_at)}
                                </p>
                              </>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </PlanGuard>
    </RouteGuard>
  )
}
