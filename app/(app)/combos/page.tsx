'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

interface Producto { id: string; nombre: string; precio: number }
interface ComboItem { producto_id: string; cantidad: number; nombre?: string }
interface Combo {
  id: string; nombre: string; descripcion: string | null
  precio: number; activo: boolean; imagen_url: string | null
  aplica_mesas: boolean; aplica_delivery: boolean
  combo_items: ComboItem[]
}

export default function PromosPage() {
  const { localId, plan } = useSession()
  const [combos, setPromos] = useState<Combo[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [editCombo, setEditCombo] = useState<Combo | null>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', aplica_mesas: true, aplica_delivery: true })
  const [items, setItems] = useState<ComboItem[]>([{ producto_id: '', cantidad: 1 }])
  const [guardando, setGuardando] = useState(false)

  const limites = getLimites(plan ?? 'basico')

  useEffect(() => { if (localId) cargar() }, [localId])

  const cargar = async () => {
    setLoading(true)
    const [{ data: combosData }, { data: prodsData }] = await Promise.all([
      supabaseApp
        .from('combos')
        .select('id, nombre, descripcion, precio, activo, imagen_url, aplica_mesas, aplica_delivery, combo_items(producto_id, cantidad)')
        .eq('local_id', localId)
        .order('nombre'),
      supabaseApp
        .from('productos')
        .select('id, nombre, precio')
        .eq('local_id', localId)
        .eq('activo', true)
        .order('nombre'),
    ])
    setPromos(combosData ?? [])
    setProductos(prodsData ?? [])
    setLoading(false)
  }

  const abrirNuevo = () => {
    setEditCombo(null)
    setForm({ nombre: '', descripcion: '', precio: '', aplica_mesas: true, aplica_delivery: true })
    setItems([{ producto_id: '', cantidad: 1 }])
    setModal(true)
  }

  const abrirEditar = (c: Combo) => {
    setEditCombo(c)
    setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', precio: String(c.precio), aplica_mesas: c.aplica_mesas, aplica_delivery: c.aplica_delivery })
    setItems(c.combo_items.length > 0 ? c.combo_items : [{ producto_id: '', cantidad: 1 }])
    setModal(true)
  }

  const agregarItem = () => setItems((prev) => [...prev, { producto_id: '', cantidad: 1 }])
  const quitarItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))
  const cambiarItem = (i: number, campo: keyof ComboItem, valor: string | number) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))

  const precioSugerido = items.reduce((acc, it) => {
    const prod = productos.find((p) => p.id === it.producto_id)
    return acc + (prod ? prod.precio * it.cantidad : 0)
  }, 0)

  const guardar = async () => {
    if (!form.nombre || !form.precio || items.some((i) => !i.producto_id)) return
    setGuardando(true)

    const payload = {
      local_id: localId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio: Number(form.precio),
      activo: true,
      aplica_mesas: form.aplica_mesas,
      aplica_delivery: form.aplica_delivery,
    }

    if (editCombo) {
      await supabaseApp.from('combos').update(payload).eq('id', editCombo.id)
      await supabaseApp.from('combo_items').delete().eq('combo_id', editCombo.id)
      await supabaseApp.from('combo_items').insert(
        items.map((i) => ({ combo_id: editCombo.id, producto_id: i.producto_id, cantidad: i.cantidad }))
      )
    } else {
      const { data: nuevo } = await supabaseApp.from('combos').insert(payload).select('id').single()
      if (nuevo) {
        await supabaseApp.from('combo_items').insert(
          items.map((i) => ({ combo_id: nuevo.id, producto_id: i.producto_id, cantidad: i.cantidad }))
        )
      }
    }

    setGuardando(false)
    setModal(false)
    cargar()
  }

  const toggleActivo = async (c: Combo) => {
    await supabaseApp.from('combos').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este combo?')) return
    await supabaseApp.from('combo_items').delete().eq('combo_id', id)
    await supabaseApp.from('combos').delete().eq('id', id)
    cargar()
  }

  if (!limites.usaCombos) {
    return (
      <RouteGuard permiso="verProductos">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-4xl mb-4">🔒</p>
            <p className="text-white font-semibold text-lg">Promos</p>
            <p className="text-gray-400 text-sm mt-2">Disponible en plan Profesional o superior</p>
          </div>
        </div>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard permiso="verProductos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Promos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Agrupá productos con un precio especial</p>
          </div>
          <button
            onClick={abrirNuevo}
            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
          >
            + Nueva promo
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : combos.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">🍔🍟🥤</p>
            <p className="text-gray-400 font-medium">No hay combos todavía</p>
            <p className="text-sm mt-1">Creá tu primer combo con un precio especial</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {combos.map((c) => {
              const nombresItems = c.combo_items.map((ci) => {
                const p = productos.find((p) => p.id === ci.producto_id)
                return p ? `${ci.cantidad}x ${p.nombre}` : null
              }).filter(Boolean)
              return (
                <div key={c.id} className={`bg-gray-900 border rounded-2xl p-4 space-y-3 ${c.activo ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{c.nombre}</p>
                      {c.descripcion && <p className="text-xs text-gray-500 mt-0.5">{c.descripcion}</p>}
                    </div>
                    <p className="text-lg font-black text-orange-500 whitespace-nowrap">${c.precio.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {nombresItems.map((n, i) => (
                      <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg">{n}</span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {c.aplica_mesas && <span className="text-[10px] bg-violet-900/60 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-md">🪑 Mesas</span>}
                    {c.aplica_delivery && <span className="text-[10px] bg-orange-900/60 text-orange-300 border border-orange-800 px-2 py-0.5 rounded-md">🛵 Delivery</span>}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => abrirEditar(c)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium py-2 rounded-xl transition">
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(c)} className={`flex-1 text-xs font-medium py-2 rounded-xl transition ${c.activo ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-green-900 hover:bg-green-800 text-green-300'}`}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => eliminar(c.id)} className="px-3 py-2 bg-red-950 hover:bg-red-900 text-red-400 text-xs rounded-xl transition">
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-white">{editCombo ? 'Editar promo' : 'Nueva promo'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre del combo</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Combo familiar"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Descripción (opcional)</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Pizza + 2 gaseosas"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Productos incluidos</label>
                  <button onClick={agregarItem} className="text-xs text-orange-400 hover:text-orange-300">+ Agregar</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={item.producto_id}
                        onChange={(e) => cambiarItem(i, 'producto_id', e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Seleccioná un producto</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre} — ${p.precio.toLocaleString()}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => cambiarItem(i, 'cantidad', Number(e.target.value))}
                        className="w-16 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-orange-500"
                      />
                      {items.length > 1 && (
                        <button onClick={() => quitarItem(i)} className="text-gray-600 hover:text-red-400 text-lg">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {precioSugerido > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Precio normal: <span className="text-gray-300">${precioSugerido.toLocaleString()}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Precio del combo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
                {precioSugerido > 0 && form.precio && Number(form.precio) < precioSugerido && (
                  <p className="text-xs text-green-500 mt-1">
                    Ahorro: ${(precioSugerido - Number(form.precio)).toLocaleString()} ({Math.round((1 - Number(form.precio) / precioSugerido) * 100)}% off)
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Disponible en</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.aplica_mesas} onChange={(e) => setForm((f) => ({ ...f, aplica_mesas: e.target.checked }))}
                      className="w-4 h-4 rounded accent-violet-500" />
                    <span className="text-sm text-gray-300">🪑 Mesas / QR</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.aplica_delivery} onChange={(e) => setForm((f) => ({ ...f, aplica_delivery: e.target.checked }))}
                      className="w-4 h-4 rounded accent-orange-500" />
                    <span className="text-sm text-gray-300">🛵 Delivery</span>
                  </label>
                </div>
              </div>

              <button
                onClick={guardar}
                disabled={guardando || !form.nombre || !form.precio || items.some((i) => !i.producto_id) || (!form.aplica_mesas && !form.aplica_delivery)}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
              >
                {guardando ? 'Guardando...' : editCombo ? 'Guardar cambios' : 'Crear promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
