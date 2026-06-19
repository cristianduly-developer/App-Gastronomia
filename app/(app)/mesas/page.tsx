'use client'
import { useEffect, useRef, useState } from 'react'
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
  pos_x: number | null
  pos_y: number | null
  comanda?: { id: string; total: number; created_at: string }
}

const ESTADO_CONFIG = {
  libre:        { label: 'Libre',        color: 'border-gray-700 bg-gray-900',          badge: 'bg-green-900 text-green-400',    dot: 'bg-green-500' },
  ocupada:      { label: 'Ocupada',      color: 'border-violet-600 bg-violet-950/30',   badge: 'bg-violet-900 text-violet-300',  dot: 'bg-violet-500' },
  pidio_cuenta: { label: 'Pidió cuenta', color: 'border-amber-500 bg-amber-950/30',     badge: 'bg-amber-900 text-amber-300',    dot: 'bg-amber-500' },
  reservada:    { label: 'Reservada',    color: 'border-blue-600 bg-blue-950/30',       badge: 'bg-blue-900 text-blue-300',      dot: 'bg-blue-500' },
}

const FILTROS = ['Todas', 'Ocupadas', 'Libres', 'Cuenta'] as const
type Filtro = typeof FILTROS[number]

const COLS = 20
const ROWS = 14
const CELL = 52

function tiempoOcupada(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function MesasPage() {
  const { localId, mesasAsignadas, rolSistema, plan } = useSession()
  const router = useRouter()
  const [sectores, setSectores] = useState<Sector[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('Todas')
  const [vistaLayout, setVistaLayout] = useState(false)
  const [editandoLayout, setEditandoLayout] = useState(false)
  const [posiciones, setPosiciones] = useState<Record<string, { x: number; y: number }>>({})
  const [guardandoLayout, setGuardandoLayout] = useState(false)
  const [sectorLayout, setSectorLayout] = useState<string>('')
  const dragging = useRef<{ mesaId: string; offX: number; offY: number } | null>(null)

  const esPremium = plan === 'premium' || plan === 'sincargo'

  useEffect(() => {
    if (!localId) return
    cargarDatos()

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

    // Init posiciones desde DB
    const pos: Record<string, { x: number; y: number }> = {}
    for (const m of mesasData ?? []) {
      if (m.pos_x != null && m.pos_y != null) {
        pos[m.id] = { x: m.pos_x, y: m.pos_y }
      }
    }
    setPosiciones(pos)

    if ((sects ?? []).length > 0 && !sectorLayout) {
      setSectorLayout((sects ?? [])[0]?.id ?? '')
    }

    setLoading(false)
  }

  // Drag handlers para el layout
  const onMouseDown = (e: React.MouseEvent, mesaId: string) => {
    if (!editandoLayout) return
    e.preventDefault()
    const rect = (e.target as HTMLElement).closest('[data-mesa]')?.getBoundingClientRect()
    dragging.current = {
      mesaId,
      offX: rect ? e.clientX - rect.left : 0,
      offY: rect ? e.clientY - rect.top : 0,
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const d = dragging.current
    if (!d || !editandoLayout) return
    const canvas = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - canvas.left) / CELL)))
    const y = Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - canvas.top) / CELL)))
    setPosiciones((prev) => ({ ...prev, [d.mesaId]: { x, y } }))
  }

  const onMouseUp = () => { dragging.current = null }

  const guardarLayout = async () => {
    setGuardandoLayout(true)
    const updates = Object.entries(posiciones).map(([id, { x, y }]) =>
      supabaseApp.from('mesas').update({ pos_x: x, pos_y: y }).eq('id', id)
    )
    await Promise.all(updates)
    setGuardandoLayout(false)
    setEditandoLayout(false)
  }

  // Mesas visibles según rol
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
    if (editandoLayout) return
    if (mesa.estado === 'libre') router.push(`/mesas/${mesa.id}/nueva-comanda`)
    else router.push(`/mesas/${mesa.id}`)
  }

  // Mesas del sector seleccionado para el layout
  const mesasLayoutSector = mesasVisibles.filter((m) => m.sector_id === sectorLayout)

  return (
    <RouteGuard permiso="verMesas">
      <PlanGuard feature="usaMesas">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-white">Mesas</h1>
          <div className="flex items-center gap-2">
            {esPremium && (
              <button
                onClick={() => { setVistaLayout(!vistaLayout); setEditandoLayout(false) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition
                  ${vistaLayout ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {vistaLayout ? '📋 Lista' : '🗺️ Salón'}
              </button>
            )}
            <button
              onClick={() => router.push('/mesas/configurar')}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              ⚙️ Configurar
            </button>
          </div>
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
        ) : vistaLayout ? (
          /* ── VISTA LAYOUT SALÓN ── */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Selector de sector + acciones */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex gap-2">
                {sectores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSectorLayout(s.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition
                      ${sectorLayout === s.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
              {rolSistema === 'owner' && (
                editandoLayout ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditandoLayout(false); cargarDatos() }}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-400 hover:text-white transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarLayout}
                      disabled={guardandoLayout}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition disabled:opacity-60"
                    >
                      {guardandoLayout ? 'Guardando...' : '✓ Guardar posiciones'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditandoLayout(true)}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-400 hover:text-white transition"
                  >
                    ✏️ Editar layout
                  </button>
                )
              )}
            </div>

            {editandoLayout && (
              <p className="text-xs text-violet-400 mb-3 flex-shrink-0">
                Arrastrá las mesas para posicionarlas como están en tu salón
              </p>
            )}

            {/* Canvas */}
            <div className="flex-1 overflow-auto">
              <div
                className="relative border border-gray-800 rounded-2xl bg-gray-900/50"
                style={{ width: COLS * CELL, height: ROWS * CELL, minWidth: COLS * CELL }}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {/* Grilla de fondo */}
                {editandoLayout && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                        <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="#6d28d9" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {/* Mesas posicionadas */}
                {mesasLayoutSector.map((mesa) => {
                  const pos = posiciones[mesa.id]
                  const cfg = ESTADO_CONFIG[mesa.estado]
                  const tienePos = pos != null

                  if (!tienePos && !editandoLayout) return null

                  const x = pos?.x ?? 0
                  const y = pos?.y ?? 0

                  return (
                    <div
                      key={mesa.id}
                      data-mesa={mesa.id}
                      onMouseDown={(e) => onMouseDown(e, mesa.id)}
                      onClick={() => handleClickMesa(mesa)}
                      style={{ left: x * CELL + 4, top: y * CELL + 4, width: CELL - 8, height: CELL - 8 }}
                      className={`absolute flex flex-col items-center justify-center rounded-xl border-2 text-xs font-bold transition select-none
                        ${cfg.color}
                        ${editandoLayout ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:scale-105'}
                        ${!tienePos ? 'opacity-60 border-dashed' : ''}
                      `}
                    >
                      <span className={`w-2 h-2 rounded-full mb-0.5 ${cfg.dot}`} />
                      <span className="text-white text-xs leading-tight text-center px-1 truncate w-full text-center">{mesa.nombre}</span>
                      {mesa.comanda && (
                        <span className="text-gray-400 text-[10px]">{tiempoOcupada(mesa.comanda.created_at)}</span>
                      )}
                    </div>
                  )
                })}

                {/* Mesas sin posición en modo edición */}
                {editandoLayout && mesasLayoutSector.filter((m) => posiciones[m.id] == null).length > 0 && (
                  <div className="absolute bottom-3 left-3 right-3 bg-gray-950/80 border border-gray-700 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-2">Sin posición — arrastrá al plano:</p>
                    <div className="flex flex-wrap gap-2">
                      {mesasLayoutSector.filter((m) => posiciones[m.id] == null).map((m, idx) => (
                        <button
                          key={m.id}
                          onClick={() => setPosiciones((prev) => {
                            const ocupadas = new Set(Object.values(prev).map(p => `${p.x},${p.y}`))
                            let x = idx % COLS, y = Math.floor(idx / COLS)
                            while (ocupadas.has(`${x},${y}`)) {
                              x = (x + 1) % COLS
                              if (x === 0) y = Math.min(y + 1, ROWS - 1)
                            }
                            return { ...prev, [m.id]: { x, y } }
                          })}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs"
                        >
                          + {m.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 mt-4 flex-shrink-0">
              {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-gray-500">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── VISTA LISTA ── */
          <>
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
          </>
        )}
      </div>
      </PlanGuard>
    </RouteGuard>
  )
}
