'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

// Cliente anon para insertar pedidos_qr desde el browser del cliente
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Categoria { id: string; nombre: string }
interface Producto { id: string; nombre: string; descripcion: string | null; precio: number; categoria_id: string | null; agotado: boolean }
interface Config { nombre_negocio: string; telefono: string | null; usa_qr_pedidos: boolean }
interface CartItem { productoId: string; nombre: string; precio: number; cantidad: number; observacion: string }

type Paso = 'menu' | 'carrito' | 'confirmado'

export default function MenuMesaPage({ params }: { params: { localId: string; mesaId: string } }) {
  const { localId, mesaId } = params

  const [config, setConfig] = useState<Config | null>(null)
  const [mesaNombre, setMesaNombre] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cart, setCart] = useState<CartItem[]>([])
  const [tabActivo, setTabActivo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [paso, setPaso] = useState<Paso>('menu')
  const [enviando, setEnviando] = useState(false)
  const [modalObs, setModalObs] = useState<{ idx: number; valor: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabaseAnon.from('config_local').select('nombre_negocio, telefono, usa_qr_pedidos').eq('local_id', localId).single(),
      supabaseAnon.from('mesas').select('nombre').eq('id', mesaId).single(),
      supabaseAnon.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseAnon.from('productos').select('id, nombre, descripcion, precio, categoria_id, agotado').eq('local_id', localId).eq('activo', true).order('nombre'),
    ]).then(([{ data: cfg }, { data: mesa }, { data: cats }, { data: prods }]) => {
      if (!cfg || !mesa) { setError('Menú no encontrado'); setLoading(false); return }
      setConfig(cfg)
      setMesaNombre(mesa.nombre)
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setLoading(false)
    })
  }, [localId, mesaId])

  const productosFiltrados = useMemo(() => {
    let list = productos.filter((p) => !p.agotado)
    if (tabActivo !== 'todos') list = list.filter((p) => p.categoria_id === tabActivo)
    if (busqueda) list = list.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    return list
  }, [productos, tabActivo, busqueda])

  const agregarAlCart = (prod: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productoId === prod.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1, observacion: '' }]
    })
  }

  const cambiarCantidad = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      const nueva = next[idx].cantidad + delta
      if (nueva <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...next[idx], cantidad: nueva }
      return next
    })
  }

  const total = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const enviarPedido = async () => {
    if (cart.length === 0 || !config) return
    setEnviando(true)

    const items = cart.map((i) => ({
      productoId: i.productoId,
      nombre: i.nombre,
      precio: i.precio,
      cantidad: i.cantidad,
      subtotal: i.precio * i.cantidad,
      observacion: i.observacion || null,
    }))

    const res = await fetch('/api/public/qr-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId, mesaId, mesaNombre, items, total }),
    })

    setEnviando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al enviar el pedido. Intentá de nuevo.')
      return
    }

    setPaso('confirmado')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <p className="text-gray-400 text-center">{error || 'Menú no encontrado'}</p>
      </div>
    )
  }

  if (paso === 'confirmado') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">¡Pedido enviado!</h1>
          <p className="text-gray-400 text-sm mb-2">{mesaNombre} — {config.nombre_negocio}</p>
          <p className="text-gray-500 text-sm">El mozo ya recibió tu pedido.</p>
          <p className="text-gray-500 text-sm mt-1">Total: <strong className="text-white">${total.toLocaleString()}</strong></p>
          <button
            onClick={() => { setCart([]); setPaso('menu') }}
            className="mt-8 text-xs text-violet-400 hover:text-violet-300 transition"
          >
            Agregar más items
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">

        {/* Nombre del negocio + mesa */}
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-violet-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-violet-900/40">
              🍽️
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-white text-lg leading-tight truncate">{config.nombre_negocio}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <p className="text-xs text-gray-400 truncate">{mesaNombre}</p>
              </div>
            </div>
          </div>
          {cart.length > 0 && paso === 'menu' && (
            <button
              onClick={() => setPaso('carrito')}
              className="relative bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2 text-sm transition flex-shrink-0"
            >
              🛒 <span className="ml-1">{cart.reduce((s, i) => s + i.cantidad, 0)}</span>
              <span className="ml-1 hidden xs:inline">pedido</span>
            </button>
          )}
        </div>

        {paso === 'menu' && (
          <>
            <div className="max-w-lg mx-auto px-4 pb-2">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en el menú..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>
            {categorias.length > 0 && (
              <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setTabActivo('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                    ${tabActivo === 'todos' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Todos
                </button>
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTabActivo(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                      ${tabActivo === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Menú */}
      {paso === 'menu' && (
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-6 pb-32">
          {categorias.map((cat) => {
            const prodsCat = productosFiltrados.filter((p) => p.categoria_id === cat.id)
            if (prodsCat.length === 0) return null
            return (
              <section key={cat.id}>
                <h2 className="text-sm font-bold text-white mb-2 pb-1 border-b border-gray-800">{cat.nombre}</h2>
                <div className="space-y-2">
                  {prodsCat.map((p) => <ProductoRow key={p.id} prod={p} onAgregar={() => agregarAlCart(p)} cart={cart} />)}
                </div>
              </section>
            )
          })}

          {/* Sin categoría */}
          {(() => {
            const sinCat = productosFiltrados.filter((p) => !p.categoria_id)
            if (sinCat.length === 0) return null
            return (
              <section>
                {categorias.length > 0 && <h2 className="text-sm font-bold text-white mb-2 pb-1 border-b border-gray-800">Otros</h2>}
                <div className="space-y-2">
                  {sinCat.map((p) => <ProductoRow key={p.id} prod={p} onAgregar={() => agregarAlCart(p)} cart={cart} />)}
                </div>
              </section>
            )
          })()}

          {productosFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🔍</p>
              <p>Sin resultados</p>
            </div>
          )}
        </div>
      )}

      {/* Carrito */}
      {paso === 'carrito' && (
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 flex flex-col">
          <button onClick={() => setPaso('menu')} className="text-gray-400 hover:text-white text-sm mb-4 transition self-start">
            ← Seguir eligiendo
          </button>
          <h2 className="font-bold text-white text-lg mb-4">Tu pedido</h2>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{item.nombre}</p>
                    <p className="text-xs text-violet-400 mt-0.5">${item.precio.toLocaleString()} c/u</p>
                  </div>
                  <p className="text-sm font-bold text-white">${(item.precio * item.cantidad).toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => cambiarCantidad(idx, -1)} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition">−</button>
                    <span className="text-sm font-bold text-white w-4 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(idx, 1)} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition">+</button>
                  </div>
                  <button
                    onClick={() => setModalObs({ idx, valor: item.observacion })}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    {item.observacion ? `"${item.observacion.slice(0, 20)}..."` : '+ Aclaración'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total y enviar */}
          <div className="mt-4 space-y-3 pb-4">
            <div className="flex items-center justify-between py-3 border-t border-gray-800">
              <span className="font-semibold text-gray-300">Total</span>
              <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
            </div>
            {!config.usa_qr_pedidos ? (
              <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-3 text-xs text-amber-300 text-center">
                Este local aún no acepta pedidos digitales. Llamá al mozo.
              </div>
            ) : (
              <button
                onClick={enviarPedido}
                disabled={enviando || cart.length === 0}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-xl py-4 text-base transition"
              >
                {enviando ? 'Enviando...' : 'Enviar pedido al mozo'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Botón flotante si hay items en menú */}
      {paso === 'menu' && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setPaso('carrito')}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 transition shadow-lg"
            >
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">
                {cart.reduce((s, i) => s + i.cantidad, 0)}
              </span>
              <span>Ver pedido</span>
              <span className="font-bold">${total.toLocaleString()}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal aclaración */}
      {modalObs !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-lg shadow-xl">
            <h3 className="font-bold text-white mb-3">Aclaración</h3>
            <textarea
              value={modalObs.valor}
              onChange={(e) => setModalObs({ ...modalObs, valor: e.target.value })}
              placeholder="Ej: sin cebolla, bien cocido, alergia a..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => setModalObs(null)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">Cancelar</button>
              <button
                onClick={() => {
                  setCart((prev) => {
                    const next = [...prev]
                    next[modalObs.idx] = { ...next[modalObs.idx], observacion: modalObs.valor }
                    return next
                  })
                  setModalObs(null)
                }}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 text-sm transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductoRow({ prod, onAgregar, cart }: { prod: Producto; onAgregar: () => void; cart: CartItem[] }) {
  const enCart = cart.find((i) => i.productoId === prod.id)
  return (
    <div className="flex items-start justify-between gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{prod.nombre}</p>
        {prod.descripcion && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{prod.descripcion}</p>}
        <p className="text-sm font-bold text-violet-400 mt-1">${prod.precio.toLocaleString()}</p>
      </div>
      <button
        onClick={onAgregar}
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold transition
          ${enCart ? 'bg-violet-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
      >
        {enCart ? enCart.cantidad : '+'}
      </button>
    </div>
  )
}
