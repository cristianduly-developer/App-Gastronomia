'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

interface Categoria {
  id: string
  nombre: string
  orden: number
}

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  categoria_id: string | null
  imagen_url: string | null
  agotado: boolean
  activo: boolean
}

export default function ProductosPage() {
  const { localId, plan } = useSession()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tab, setTab] = useState<'productos' | 'categorias'>('productos')
  const [loading, setLoading] = useState(true)

  // Modal producto
  const [modalProd, setModalProd] = useState(false)
  const [editProd, setEditProd] = useState<Producto | null>(null)
  const [formProd, setFormProd] = useState({ nombre: '', descripcion: '', precio: '', categoria_id: '' })

  // Modal categoría
  const [modalCat, setModalCat] = useState(false)
  const [editCat, setEditCat] = useState<Categoria | null>(null)
  const [formCat, setFormCat] = useState({ nombre: '' })

  const limites = getLimites(plan ?? 'basico')
  const productosActivos = productos.filter((p) => p.activo).length
  const limiteProd = limites.productos
  const productosBloqueado = limiteProd !== null && productosActivos >= limiteProd

  useEffect(() => {
    if (!localId) return
    cargarDatos()
  }, [localId])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabaseApp.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseApp.from('productos').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
    ])
    setCategorias(cats ?? [])
    setProductos(prods ?? [])
    setLoading(false)
  }

  // ── Productos ──────────────────────────────────────────────
  const abrirNuevoProd = () => {
    setEditProd(null)
    setFormProd({ nombre: '', descripcion: '', precio: '', categoria_id: '' })
    setModalProd(true)
  }

  const abrirEditProd = (p: Producto) => {
    setEditProd(p)
    setFormProd({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), categoria_id: p.categoria_id ?? '' })
    setModalProd(true)
  }

  const guardarProducto = async () => {
    if (!formProd.nombre || !formProd.precio) return
    const payload = {
      local_id: localId,
      nombre: formProd.nombre.trim(),
      descripcion: formProd.descripcion.trim() || null,
      precio: Number(formProd.precio),
      categoria_id: formProd.categoria_id || null,
      activo: true,
      agotado: false,
    }
    if (editProd) {
      await supabaseApp.from('productos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editProd.id)
    } else {
      await supabaseApp.from('productos').insert(payload)
    }
    setModalProd(false)
    cargarDatos()
  }

  const toggleAgotado = async (p: Producto) => {
    await supabaseApp.from('productos').update({ agotado: !p.agotado, updated_at: new Date().toISOString() }).eq('id', p.id)
    setProductos((prev) => prev.map((x) => x.id === p.id ? { ...x, agotado: !x.agotado } : x))
  }

  const eliminarProducto = async (id: string) => {
    await supabaseApp.from('productos').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
    setProductos((prev) => prev.filter((p) => p.id !== id))
  }

  // ── Categorías ─────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setEditCat(null)
    setFormCat({ nombre: '' })
    setModalCat(true)
  }

  const abrirEditCat = (c: Categoria) => {
    setEditCat(c)
    setFormCat({ nombre: c.nombre })
    setModalCat(true)
  }

  const guardarCategoria = async () => {
    if (!formCat.nombre) return
    if (editCat) {
      await supabaseApp.from('categorias').update({ nombre: formCat.nombre.trim(), updated_at: new Date().toISOString() }).eq('id', editCat.id)
    } else {
      await supabaseApp.from('categorias').insert({ local_id: localId, nombre: formCat.nombre.trim(), orden: categorias.length + 1, activo: true })
    }
    setModalCat(false)
    cargarDatos()
  }

  const eliminarCategoria = async (id: string) => {
    await supabaseApp.from('categorias').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
    setCategorias((prev) => prev.filter((c) => c.id !== id))
  }

  const catNombre = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? '—'

  return (
    <RouteGuard permiso="verProductos">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Productos</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {productosActivos}{limiteProd ? ` / ${limiteProd}` : ''} productos activos
            </p>
          </div>
          <button
            onClick={tab === 'productos' ? abrirNuevoProd : abrirNuevaCat}
            disabled={tab === 'productos' && productosBloqueado}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
          >
            + {tab === 'productos' ? 'Nuevo producto' : 'Nueva categoría'}
          </button>
        </div>

        {productosBloqueado && tab === 'productos' && (
          <div className="bg-amber-950 border border-amber-700 text-amber-300 rounded-xl p-3 text-sm mb-4">
            Alcanzaste el límite de {limiteProd} productos de tu plan. Actualizá tu plan para agregar más.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['productos', 'categorias'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition capitalize
                ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Lista productos */}
            {tab === 'productos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {productos.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-16">
                    <p className="text-4xl mb-3">🍔</p>
                    <p>No hay productos todavía. ¡Agregá el primero!</p>
                  </div>
                )}
                {productos.map((p) => (
                  <div key={p.id} className={`bg-gray-900 border rounded-2xl p-4 flex flex-col gap-3 ${p.agotado ? 'border-red-800 opacity-70' : 'border-gray-800'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{catNombre(p.categoria_id)}</p>
                        {p.descripcion && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.descripcion}</p>}
                      </div>
                      <p className="text-violet-400 font-bold text-lg shrink-0">${p.precio.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAgotado(p)}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition
                          ${p.agotado ? 'bg-red-950 text-red-400 hover:bg-red-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                      >
                        {p.agotado ? '🔴 Agotado' : '🟢 Disponible'}
                      </button>
                      <button onClick={() => abrirEditProd(p)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">
                        Editar
                      </button>
                      <button onClick={() => eliminarProducto(p.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-red-400 hover:bg-red-950 text-xs transition">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista categorías */}
            {tab === 'categorias' && (
              <div className="space-y-2">
                {categorias.length === 0 && (
                  <div className="text-center text-gray-500 py-16">
                    <p className="text-4xl mb-3">📂</p>
                    <p>No hay categorías todavía. ¡Agregá la primera!</p>
                  </div>
                )}
                {categorias.map((c) => (
                  <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{productos.filter((p) => p.categoria_id === c.id).length} productos</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditCat(c)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">
                        Editar
                      </button>
                      <button onClick={() => eliminarCategoria(c.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-red-400 hover:bg-red-950 text-xs transition">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal producto */}
      {modalProd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">{editProd ? 'Editar producto' : 'Nuevo producto'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
                <input
                  value={formProd.nombre}
                  onChange={(e) => setFormProd((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Hamburguesa clásica"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
                <textarea
                  value={formProd.descripcion}
                  onChange={(e) => setFormProd((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ingredientes o descripción breve"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Precio *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formProd.precio}
                  onChange={(e) => setFormProd((f) => ({ ...f, precio: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría</label>
                <select
                  value={formProd.categoria_id}
                  onChange={(e) => setFormProd((f) => ({ ...f, categoria_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalProd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition text-sm">
                Cancelar
              </button>
              <button
                onClick={guardarProducto}
                disabled={!formProd.nombre || !formProd.precio}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition text-sm"
              >
                {editProd ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal categoría */}
      {modalCat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">{editCat ? 'Editar categoría' : 'Nueva categoría'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
              <input
                value={formCat.nombre}
                onChange={(e) => setFormCat({ nombre: e.target.value })}
                placeholder="Ej: Hamburguesas, Pizzas, Bebidas..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalCat(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition text-sm">
                Cancelar
              </button>
              <button
                onClick={guardarCategoria}
                disabled={!formCat.nombre}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition text-sm"
              >
                {editCat ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
