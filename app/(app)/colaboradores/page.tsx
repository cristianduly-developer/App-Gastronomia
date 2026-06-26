'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

interface Colaborador {
  id: string
  nombre: string
  email: string
  rol: 'cajero' | 'mozo' | 'cocina'
  activo: boolean
  created_at: string
  mesas_asignadas: string[] | null
}

interface Mesa { id: string; nombre: string; sector_nombre: string }

const ROLES = [
  { value: 'mozo',   label: 'Mozo',   emoji: '🧑‍🍽️', desc: 'Ve mesas, toma comandas y acepta pedidos QR' },
  { value: 'cocina', label: 'Cocina',  emoji: '👨‍🍳', desc: 'Ve solo el monitor de cocina' },
  { value: 'cajero', label: 'Cajero',  emoji: '💰', desc: 'Ve ventas, caja y clientes' },
] as const

const ROL_BADGE: Record<string, string> = {
  mozo:   'bg-blue-900 text-blue-300',
  cocina: 'bg-orange-900 text-orange-300',
  cajero: 'bg-green-900 text-green-300',
}

export default function ColaboradoresPage() {
  const { localId, plan } = useSession()
  const limites = getLimites(plan)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Colaborador | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'mozo' as 'cajero' | 'mozo' | 'cocina' })
  const [mesasSelec, setMesasSelec] = useState<string[]>([])   // ids seleccionadas; vacío = todas
  const [todasLasMesas, setTodasLasMesas] = useState(true)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localId) return
    cargar()
    // Cargar mesas para el selector
    supabaseApp
      .from('mesas')
      .select('id, nombre, sectores(nombre)')
      .eq('local_id', localId)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        setMesas((data ?? []).map((m: any) => ({
          id: m.id,
          nombre: m.nombre,
          sector_nombre: m.sectores?.nombre ?? '',
        })))
      })
  }, [localId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('colaboradores')
      .select('*')
      .eq('local_id', localId)
      .order('nombre')
    setColaboradores(data ?? [])
    setLoading(false)
  }

  const abrirNuevo = () => {
    const activos = colaboradores.filter((c) => c.activo)
    if (activos.length >= limites.colaboradores) {
      setError(`Tu plan permite hasta ${limites.colaboradores} colaborador${limites.colaboradores !== 1 ? 'es' : ''} activo${limites.colaboradores !== 1 ? 's' : ''}. Actualizá tu plan para agregar más.`)
      setModal(true)
      setEditando(null)
      setForm({ nombre: '', email: '', rol: 'mozo' })
      return
    }
    setEditando(null)
    setForm({ nombre: '', email: '', rol: 'mozo' })
    setMesasSelec([])
    setTodasLasMesas(true)
    setError('')
    setModal(true)
  }

  const abrirEditar = (c: Colaborador) => {
    setEditando(c)
    setForm({ nombre: c.nombre, email: c.email, rol: c.rol })
    const tieneAsignadas = c.mesas_asignadas && c.mesas_asignadas.length > 0
    setTodasLasMesas(!tieneAsignadas)
    setMesasSelec(c.mesas_asignadas ?? [])
    setError('')
    setModal(true)
  }

  const toggleMesa = (id: string) => {
    setMesasSelec((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const mesasAsignadasFinal = todasLasMesas ? null : (mesasSelec.length > 0 ? mesasSelec : null)

  const guardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) return
    setGuardando(true)
    setError('')

    if (editando) {
      const { error: err } = await supabaseApp
        .from('colaboradores')
        .update({ nombre: form.nombre.trim(), rol: form.rol, mesas_asignadas: mesasAsignadasFinal })
        .eq('id', editando.id)
      if (err) { setError('Error al guardar'); setGuardando(false); return }
    } else {
      // Verificar que no exista
      const { data: existe } = await supabaseApp
        .from('colaboradores')
        .select('id')
        .eq('local_id', localId)
        .eq('email', form.email.trim().toLowerCase())
        .maybeSingle()

      if (existe) { setError('Ese email ya está registrado como colaborador'); setGuardando(false); return }

      const { data: { session } } = await supabaseApp.auth.getSession()
      const res = await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), rol: form.rol, localId, mesasAsignadas: mesasAsignadasFinal }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error al guardar el colaborador'); setGuardando(false); return }
    }

    setGuardando(false)
    setModal(false)
    cargar()
  }

  const toggleActivo = async (c: Colaborador) => {
    await supabaseApp.from('colaboradores').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este colaborador? Ya no podrá entrar a la app.')) return
    await supabaseApp.from('colaboradores').delete().eq('id', id)
    cargar()
  }

  const activos   = colaboradores.filter((c) => c.activo)
  const inactivos = colaboradores.filter((c) => !c.activo)

  return (
    <RouteGuard permiso="verColaboradores">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Colaboradores</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {colaboradores.filter((c) => c.activo).length} / {limites.colaboradores} del plan
            </p>
          </div>
          <button
            onClick={abrirNuevo}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
          >
            + Agregar
          </button>
        </div>

        {/* Referencia de roles */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {ROLES.map((r) => (
            <div key={r.value} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-base mb-1">{r.emoji}</p>
              <p className="text-sm font-semibold text-white">{r.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : colaboradores.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">👥</p>
            <p>Aún no hay colaboradores</p>
            <p className="text-sm mt-1">Agregá mozos, cocineros o cajeros para que puedan entrar a la app</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Activos */}
            {activos.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-400">Activos ({activos.length})</h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {activos.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-9 h-9 bg-gray-800 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                        {ROLES.find((r) => r.value === c.rol)?.emoji ?? '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">{c.email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${ROL_BADGE[c.rol]}`}>
                        {ROLES.find((r) => r.value === c.rol)?.label}
                      </span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => abrirEditar(c)} className="text-xs text-gray-400 hover:text-white transition">Editar</button>
                        <button onClick={() => toggleActivo(c)} className="text-xs text-amber-400 hover:text-amber-300 transition">Desactivar</button>
                        <button onClick={() => eliminar(c.id)} className="text-xs text-red-400 hover:text-red-300 transition">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inactivos */}
            {inactivos.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden opacity-60">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-500">Inactivos ({inactivos.length})</h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {inactivos.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-9 h-9 bg-gray-800 rounded-xl flex items-center justify-center text-base flex-shrink-0 grayscale">
                        {ROLES.find((r) => r.value === c.rol)?.emoji ?? '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-400 truncate">{c.nombre}</p>
                        <p className="text-xs text-gray-600 truncate">{c.email}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => toggleActivo(c)} className="text-xs text-green-400 hover:text-green-300 transition">Activar</button>
                        <button onClick={() => eliminar(c.id)} className="text-xs text-red-400 hover:text-red-300 transition">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info de acceso */}
        <div className="mt-6 bg-blue-950/30 border border-blue-900 rounded-2xl p-4">
          <p className="text-sm font-semibold text-blue-300 mb-1">¿Cómo entra un colaborador?</p>
          <ol className="text-xs text-blue-400 space-y-1 list-decimal list-inside">
            <li>El colaborador abre la app en su celular</li>
            <li>Inicia sesión con el <strong>mismo Google del email que cargaste acá</strong></li>
            <li>Entra directo a su pantalla (el mozo ve mesas, cocina ve la pantalla de cocina, etc.)</li>
          </ol>
        </div>
      </div>

      {/* Modal agregar/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">
              {editando ? 'Editar colaborador' : 'Agregar colaborador'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre y apellido"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {!editando && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Email de Google</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@gmail.com"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">Debe ser el mismo con el que va a entrar</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-2">Rol</label>
                <div className="space-y-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setForm((f) => ({ ...f, rol: r.value }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition
                        ${form.rol === r.value
                          ? 'bg-violet-950 border-violet-600'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                    >
                      <span className="text-xl">{r.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{r.label}</p>
                        <p className="text-xs text-gray-400">{r.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${form.rol === r.value ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de mesas — solo para mozos */}
              {form.rol === 'mozo' && mesas.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Mesas que cubre</label>
                  <button
                    type="button"
                    onClick={() => { setTodasLasMesas(true); setMesasSelec([]) }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition mb-2
                      ${todasLasMesas ? 'bg-violet-950 border-violet-600' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Todas las mesas</p>
                      <p className="text-xs text-gray-400">Ve y puede atender cualquier mesa</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${todasLasMesas ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTodasLasMesas(false)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition mb-2
                      ${!todasLasMesas ? 'bg-violet-950 border-violet-600' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Mesas específicas</p>
                      <p className="text-xs text-gray-400">Solo ve sus mesas asignadas</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${!todasLasMesas ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`} />
                  </button>
                  {!todasLasMesas && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {mesas.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMesa(m.id)}
                          className={`p-2 rounded-xl border text-xs font-medium transition text-center
                            ${mesasSelec.includes(m.id)
                              ? 'bg-violet-600 border-violet-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                          <p>{m.nombre}</p>
                          {m.sector_nombre && <p className="text-gray-500 text-xs font-normal truncate">{m.sector_nombre}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-3 py-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModal(false)}
                className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!form.nombre.trim() || (!editando && !form.email.trim()) || guardando}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
