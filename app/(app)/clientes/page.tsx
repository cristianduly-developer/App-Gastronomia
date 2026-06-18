'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Cliente {
  id: string
  nombre: string
  telefono: string | null
  observaciones: string | null
  total_gastado?: number
  cantidad_compras?: number
}

const FORM_VACIO = { nombre: '', telefono: '', observaciones: '' }

export default function ClientesPage() {
  const { localId } = useSession()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!localId) return
    cargarClientes()
  }, [localId])

  const cargarClientes = async () => {
    setLoading(true)
    const { data } = await supabaseApp
      .from('clientes')
      .select(`
        id, nombre, telefono, observaciones,
        ventas(total)
      `)
      .eq('local_id', localId)
      .eq('activo', true)
      .order('nombre')

    const clientesConTotales = (data ?? []).map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      observaciones: c.observaciones,
      cantidad_compras: c.ventas?.length ?? 0,
      total_gastado: c.ventas?.reduce((acc: number, v: any) => acc + (v.total ?? 0), 0) ?? 0,
    }))

    setClientes(clientesConTotales)
    setLoading(false)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setModal(true)
  }

  const abrirEditar = (c: Cliente) => {
    setEditando(c)
    setForm({ nombre: c.nombre, telefono: c.telefono ?? '', observaciones: c.observaciones ?? '' })
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    const payload = {
      local_id: localId,
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      observaciones: form.observaciones.trim() || null,
    }
    if (editando) {
      await supabaseApp.from('clientes').update(payload).eq('id', editando.id)
    } else {
      await supabaseApp.from('clientes').insert(payload)
    }
    setGuardando(false)
    setModal(false)
    cargarClientes()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabaseApp.from('clientes').update({ activo: false }).eq('id', id)
    setClientes((prev) => prev.filter((c) => c.id !== id))
  }

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda)
  )

  return (
    <RouteGuard permiso="verClientes">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Clientes</h1>
            <p className="text-gray-400 text-sm mt-0.5">{clientes.length} clientes registrados</p>
          </div>
          <button
            onClick={abrirNuevo}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
          >
            + Nuevo cliente
          </button>
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full max-w-sm bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {filtrados.length === 0 ? (
              <div className="text-center text-gray-500 py-16">
                <p className="text-4xl mb-3">👥</p>
                <p>{busqueda ? 'No hay resultados' : 'No hay clientes todavía'}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden sm:table-cell">Teléfono</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-5 py-3 hidden md:table-cell">Compras</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Total gastado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtrados.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/50 transition">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white text-sm">{c.nombre}</p>
                        {c.observaciones && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{c.observaciones}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 hidden sm:table-cell">
                        {c.telefono ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 text-right hidden md:table-cell">
                        {c.cantidad_compras}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-violet-400 text-right">
                        ${(c.total_gastado ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => abrirEditar(c)} className="text-xs text-gray-400 hover:text-white transition">
                            Editar
                          </button>
                          <button onClick={() => eliminar(c.id)} className="text-xs text-red-400 hover:text-red-300 transition">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">
              {editando ? 'Editar cliente' : 'Nuevo cliente'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre del cliente"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Teléfono</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="Ej: 2235001234"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  placeholder="Alergias, preferencias, etc."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!form.nombre.trim() || guardando}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition text-sm"
              >
                {guardando ? 'Guardando...' : editando ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
