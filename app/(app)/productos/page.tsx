'use client'
import { useEffect, useRef, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'
import { mensajeErrorGuardado } from '@/lib/errores'

interface Categoria { id: string; nombre: string; orden: number }
interface Producto {
  id: string; nombre: string; descripcion: string | null; precio: number
  categoria_id: string | null; imagen_url: string | null; agotado: boolean; activo: boolean
}

export default function ProductosPage() {
  const { localId, plan } = useSession()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tab, setTab] = useState<'productos' | 'categorias'>('productos')
  const [loading, setLoading] = useState(true)

  const [modalProd, setModalProd] = useState(false)
  const [editProd, setEditProd] = useState<Producto | null>(null)
  const [formProd, setFormProd] = useState({ nombre: '', descripcion: '', precio: '', categoria_id: '' })
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [guardandoProd, setGuardandoProd] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const [modalCat, setModalCat] = useState(false)
  const [editCat, setEditCat] = useState<Categoria | null>(null)
  const [formCat, setFormCat] = useState({ nombre: '' })

  const limites = getLimites(plan ?? 'basico')
  const productosActivos = productos.filter((p) => p.activo).length
  const limiteProd = limites.productos
  const productosBloqueado = limiteProd !== null && productosActivos >= limiteProd

  useEffect(() => { if (localId) cargarDatos() }, [localId])

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

  const abrirNuevoProd = () => {
    setEditProd(null)
    setFormProd({ nombre: '', descripcion: '', precio: '', categoria_id: '' })
    setImgFile(null)
    setImgPreview('')
    setModalProd(true)
  }

  const abrirEditProd = (p: Producto) => {
    setEditProd(p)
    setFormProd({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), categoria_id: p.categoria_id ?? '' })
    setImgFile(null)
    setImgPreview(p.imagen_url ?? '')
    setModalProd(true)
  }

  const onSelectImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { alert('La imagen no puede superar 3 MB'); return }
    setImgFile(f)
    setImgPreview(URL.createObjectURL(f))
  }

  const subirImagen = async (prodId: string): Promise<string | null> => {
    if (!imgFile || !localId) return null
    setSubiendoImg(true)
    const ext = imgFile.name.split('.').pop() ?? 'jpg'
    const path = `${localId}/${prodId}.${ext}`
    const { error } = await supabaseApp.storage.from('product-images').upload(path, imgFile, { upsert: true })
    setSubiendoImg(false)
    if (error) { console.error('Error subiendo imagen:', error); return null }
    const { data: { publicUrl } } = supabaseApp.storage.from('product-images').getPublicUrl(path)
    return `${publicUrl}?v=${Date.now()}`
  }

  const guardarProducto = async () => {
    if (!formProd.nombre || !formProd.precio) return
    setGuardandoProd(true)
    const payload = {
      local_id: localId,
      nombre: formProd.nombre.trim(),
      descripcion: formProd.descripcion.trim() || null,
      precio: Number(formProd.precio),
      categoria_id: formProd.categoria_id || null,
      activo: true,
      agotado: false,
    }

    let prodId: string | null = null

    if (editProd) {
      const { error } = await supabaseApp.from('productos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editProd.id)
      if (error) { alert(mensajeErrorGuardado(error) || ('Error al guardar: ' + error.message)); setGuardandoProd(false); return }
      prodId = editProd.id
    } else {
      const { data, error } = await supabaseApp.from('productos').insert(payload).select('id').single()
      if (error) { alert(error.message.includes('límite') ? error.message : (mensajeErrorGuardado(error) || 'Error al agregar el producto')); setGuardandoProd(false); return }
      prodId = data.id
    }

    if (imgFile && prodId) {
      const url = await subirImagen(prodId)
      if (url) await supabaseApp.from('productos').update({ imagen_url: url }).eq('id', prodId)
    }

    setGuardandoProd(false)
    setModalProd(false)
    cargarDatos()
  }

  const quitarImagen = async (p: Producto) => {
    await supabaseApp.from('productos').update({ imagen_url: null }).eq('id', p.id)
    setProductos((prev) => prev.map((x) => x.id === p.id ? { ...x, imagen_url: null } : x))
    if (editProd?.id === p.id) setImgPreview('')
  }

  const toggleAgotado = async (p: Producto) => {
    await supabaseApp.from('productos').update({ agotado: !p.agotado, updated_at: new Date().toISOString() }).eq('id', p.id)
    setProductos((prev) => prev.map((x) => x.id === p.id ? { ...x, agotado: !x.agotado } : x))
  }

  const eliminarProducto = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    const { error } = await supabaseApp.from('productos').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert('Error al eliminar el producto'); return }
    setProductos((prev) => prev.filter((p) => p.id !== id))
  }

  const abrirNuevaCat = () => { setEditCat(null); setFormCat({ nombre: '' }); setModalCat(true) }
  const abrirEditCat = (c: Categoria) => { setEditCat(c); setFormCat({ nombre: c.nombre }); setModalCat(true) }

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

        <div className="flex gap-2 mb-6">
          {(['productos', 'categorias'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition capitalize ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
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
            {tab === 'productos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {productos.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-16">
                    <p className="text-4xl mb-3">🍔</p>
                    <p>No hay productos todavía. ¡Agregá el primero!</p>
                  </div>
                )}
                {productos.map((p) => (
                  <div key={p.id} className={`bg-gray-900 border rounded-2xl overflow-hidden flex flex-col ${p.agotado ? 'border-red-800 opacity-70' : 'border-gray-800'}`}>
                    {/* Imagen del producto */}
                    <div className="relative w-full h-36 bg-gray-800 flex-shrink-0">
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🍽️</div>
                      }
                      {p.agotado && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-xs font-bold text-red-300 bg-red-950/80 border border-red-800 px-3 py-1 rounded-lg">AGOTADO</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{catNombre(p.categoria_id)}</p>
                          {p.descripcion && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.descripcion}</p>}
                        </div>
                        <p className="text-orange-400 font-bold text-lg shrink-0">${p.precio.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleAgotado(p)}
                          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition ${p.agotado ? 'bg-red-950 text-red-400 hover:bg-red-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
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
                  </div>
                ))}
              </div>
            )}

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
                      <button onClick={() => abrirEditCat(c)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs transition">Editar</button>
                      <button onClick={() => eliminarCategoria(c.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-red-400 hover:bg-red-950 text-xs transition">Eliminar</button>
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
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-5">{editProd ? 'Editar producto' : 'Nuevo producto'}</h3>

              {/* Imagen */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-300 mb-2">Foto del plato</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {imgPreview
                      ? <img src={imgPreview} alt="preview" className="w-full h-full object-cover" />
                      : <span className="text-3xl opacity-30">🍽️</span>
                    }
                  </div>
                  <div className="flex flex-col gap-2">
                    <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onSelectImg} />
                    <button onClick={() => imgInputRef.current?.click()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition">
                      {imgPreview ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {imgPreview && (
                      <button onClick={() => { setImgFile(null); setImgPreview(''); if (editProd) quitarImagen(editProd) }}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-xs font-semibold rounded-xl transition">
                        Quitar foto
                      </button>
                    )}
                    <p className="text-xs text-gray-600">JPG, PNG · máx 3 MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
                  <input value={formProd.nombre} onChange={(e) => setFormProd((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Hamburguesa clásica"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
                  <textarea value={formProd.descripcion} onChange={(e) => setFormProd((f) => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Ingredientes o descripción breve" rows={2}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Precio *</label>
                  <input type="number" inputMode="decimal" value={formProd.precio} onChange={(e) => setFormProd((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría</label>
                  <select value={formProd.categoria_id} onChange={(e) => setFormProd((f) => ({ ...f, categoria_id: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500">
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setModalProd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition text-sm">
                  Cancelar
                </button>
                <button onClick={guardarProducto} disabled={!formProd.nombre || !formProd.precio || guardandoProd || subiendoImg}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition text-sm">
                  {guardandoProd || subiendoImg ? 'Guardando...' : editProd ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal categoría */}
      {modalCat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">{editCat ? 'Editar categoría' : 'Nueva categoría'}</h3>
            <input value={formCat.nombre} onChange={(e) => setFormCat({ nombre: e.target.value })}
              placeholder="Ej: Hamburguesas, Pizzas, Bebidas..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalCat(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition text-sm">Cancelar</button>
              <button onClick={guardarCategoria} disabled={!formCat.nombre}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition text-sm">
                {editCat ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
