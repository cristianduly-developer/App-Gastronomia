'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string; nombre: string; descripcion: string | null
  precio: number; categoria_id: string | null; agotado: boolean; imagen_url: string | null
}
interface Config { nombre_negocio: string; telefono: string | null; usa_qr_pedidos: boolean; logo_url: string | null; tipo_negocio: string }
interface CartItem { productoId: string; nombre: string; precio: number; cantidad: number; observacion: string }

type Paso = 'menu' | 'carrito' | 'confirmado'

const TIPO_LABELS: Record<string, string> = {
  food_truck: 'Food Truck', rotiseria: 'Rotisería', pizzeria: 'Pizzería',
  restaurante: 'Restaurante', cafeteria: 'Cafetería', otro: 'Gastronomía',
}

export default function MenuMesaPage() {
  const params = useParams()
  const localId = params.localId as string
  const mesaId = params.mesaId as string

  const [config, setConfig] = useState<Config | null>(null)
  const [mesaNombre, setMesaNombre] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cart, setCart] = useState<CartItem[]>([])
  const [tabActivo, setTabActivo] = useState('todos')
  const [paso, setPaso] = useState<Paso>('menu')
  const [enviando, setEnviando] = useState(false)
  const [modalObs, setModalObs] = useState<{ idx: number; valor: string } | null>(null)

  const fetchProductos = () =>
    supabaseAnon.from('productos').select('id, nombre, descripcion, precio, categoria_id, agotado, imagen_url').eq('local_id', localId).eq('activo', true).order('nombre')
      .then(({ data: prods }) => { if (prods) setProductos(prods) })

  useEffect(() => {
    Promise.all([
      supabaseAnon.from('config_local').select('nombre_negocio, telefono, usa_qr_pedidos, logo_url, tipo_negocio').eq('local_id', localId).single(),
      supabaseAnon.from('mesas').select('nombre').eq('id', mesaId).single(),
      supabaseAnon.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseAnon.from('productos').select('id, nombre, descripcion, precio, categoria_id, agotado, imagen_url').eq('local_id', localId).eq('activo', true).order('nombre'),
    ]).then(([{ data: cfg }, { data: mesa }, { data: cats }, { data: prods }]) => {
      if (!cfg || !mesa) { setError('Menú no encontrado'); setLoading(false); return }
      setConfig(cfg)
      setMesaNombre(mesa.nombre)
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setLoading(false)
    })

    const interval = setInterval(fetchProductos, 60_000)
    return () => clearInterval(interval)
  }, [localId, mesaId])

  const prodsFiltrados = useMemo(() => {
    if (tabActivo === 'todos') return productos
    return productos.filter((p) => p.categoria_id === tabActivo)
  }, [productos, tabActivo])

  const agregarAlCart = (prod: Producto) => {
    if (prod.agotado) return
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
  const cantTotal = cart.reduce((s, i) => s + i.cantidad, 0)

  const enviarPedido = async () => {
    if (cart.length === 0 || !config) return
    setEnviando(true)
    const items = cart.map((i) => ({
      producto_id: i.productoId, nombre: i.nombre, precio: i.precio,
      cantidad: i.cantidad, subtotal: i.precio * i.cantidad, observacion: i.observacion || null,
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
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
        <p className="text-gray-400 text-center">{error || 'Menú no encontrado'}</p>
      </div>
    )
  }

  if (paso === 'confirmado') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">¡Pedido enviado!</h1>
          <p className="text-gray-400 text-sm mb-1">{mesaNombre} · {config.nombre_negocio}</p>
          <p className="text-gray-500 text-sm">El mozo ya recibió tu pedido.</p>
          <p className="text-gray-400 text-sm mt-1">Total: <strong className="text-white">${total.toLocaleString()}</strong></p>
          <button onClick={() => { setCart([]); setPaso('menu') }}
            className="mt-8 text-xs text-orange-400 hover:text-orange-300 transition">
            Agregar más items
          </button>
        </div>
      </div>
    )
  }

  const waLink = config.telefono ? `https://wa.me/549${config.telefono.replace(/\D/g, '')}` : null

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1e1e1e] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-[#252525] flex items-center justify-center">
              {config.logo_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={config.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                : <span className="text-2xl">🍽️</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-white text-lg leading-tight truncate">{config.nombre_negocio}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">{mesaNombre}</span>
              </div>
            </div>
            {paso === 'menu' && cart.length > 0 && (
              <button onClick={() => setPaso('carrito')}
                className="flex-shrink-0 bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5">
                🛒 {cantTotal}
              </button>
            )}
            {paso === 'carrito' && (
              <button onClick={() => setPaso('menu')} className="flex-shrink-0 text-gray-400 hover:text-white transition text-sm">← Volver</button>
            )}
          </div>

          {paso === 'menu' && (config.telefono || waLink) && (
            <div className="flex gap-2 mt-3">
              {config.telefono && (
                <a href={`tel:${config.telefono}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded-xl py-2.5 text-xs font-medium text-white transition">
                  📞 Llamar
                </a>
              )}
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded-xl py-2.5 text-xs font-medium text-white transition">
                  💬 WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {paso === 'menu' && categorias.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => setTabActivo('todos')}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition ${tabActivo === 'todos' ? 'bg-orange-500 text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}>
              Todos
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setTabActivo(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition ${tabActivo === c.id ? 'bg-orange-500 text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}>
                {c.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MENÚ */}
      {paso === 'menu' && (
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-8 pb-32">
          {config.usa_qr_pedidos && (
            <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-4 py-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-sm font-semibold text-orange-400">Pedí desde acá</p>
                <p className="text-xs text-gray-400 mt-0.5">Tu pedido llega directo a cocina</p>
              </div>
            </div>
          )}
          {tabActivo === 'todos' ? (
            categorias.map((cat) => {
              const prodsCat = prodsFiltrados.filter((p) => p.categoria_id === cat.id)
              if (prodsCat.length === 0) return null
              return (
                <section key={cat.id}>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{cat.nombre}</h2>
                  <div className="space-y-3">
                    {prodsCat.map((p) => (
                      <ProductoCard key={p.id} prod={p} cart={cart} onAgregar={() => agregarAlCart(p)} onCambiar={(delta) => {
                        const idx = cart.findIndex((i) => i.productoId === p.id)
                        if (idx >= 0) cambiarCantidad(idx, delta)
                      }} conPedido={config.usa_qr_pedidos} />
                    ))}
                  </div>
                </section>
              )
            })
          ) : (
            <div className="space-y-3">
              {prodsFiltrados.map((p) => (
                <ProductoCard key={p.id} prod={p} cart={cart} onAgregar={() => agregarAlCart(p)} onCambiar={(delta) => {
                  const idx = cart.findIndex((i) => i.productoId === p.id)
                  if (idx >= 0) cambiarCantidad(idx, delta)
                }} conPedido={config.usa_qr_pedidos} />
              ))}
            </div>
          )}

          {prodsFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🍽️</p>
              <p>Sin productos en esta categoría</p>
            </div>
          )}
        </div>
      )}

      {/* CARRITO */}
      {paso === 'carrito' && (
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-5 flex flex-col pb-8">
          <h2 className="font-bold text-white text-lg mb-4">Tu pedido · {mesaNombre}</h2>

          <div className="flex-1 space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-[#181818] border border-[#252525] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{item.nombre}</p>
                    <p className="text-xs text-orange-500 mt-0.5">${item.precio.toLocaleString()} c/u</p>
                  </div>
                  <p className="text-sm font-bold text-white">${(item.precio * item.cantidad).toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => cambiarCantidad(idx, -1)}
                      className="w-8 h-8 rounded-xl bg-[#252525] hover:bg-[#333] text-white flex items-center justify-center transition text-lg font-bold">−</button>
                    <span className="text-sm font-bold text-white w-4 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(idx, 1)}
                      className="w-8 h-8 rounded-xl bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center transition text-lg font-bold">+</button>
                  </div>
                  <button onClick={() => setModalObs({ idx, valor: item.observacion })}
                    className="text-xs text-gray-500 hover:text-gray-300 transition">
                    {item.observacion ? `📝 ${item.observacion.slice(0, 20)}` : '+ Aclaración'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between py-3 border-t border-[#252525]">
              <span className="font-semibold text-gray-300">Total</span>
              <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
            </div>
            {!config.usa_qr_pedidos ? (
              <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-3 text-xs text-amber-300 text-center">
                Este local aún no acepta pedidos digitales. Llamá al mozo.
              </div>
            ) : (
              <button onClick={enviarPedido} disabled={enviando || cart.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition">
                {enviando ? 'Enviando...' : `Enviar pedido a ${mesaNombre}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra flotante de carrito */}
      {paso === 'menu' && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-10">
          <div className="max-w-lg mx-auto">
            <button onClick={() => setPaso('carrito')}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 transition shadow-2xl">
              <span className="bg-white/20 rounded-xl w-7 h-7 flex items-center justify-center text-sm font-bold">{cantTotal}</span>
              <span className="text-base">Ver pedido</span>
              <span className="font-bold">${total.toLocaleString()}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal aclaración */}
      {modalObs !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-[#181818] border border-[#252525] rounded-2xl p-5 w-full max-w-lg shadow-xl">
            <h3 className="font-bold text-white mb-3">Aclaración</h3>
            <textarea
              value={modalObs.valor}
              onChange={(e) => setModalObs({ ...modalObs, valor: e.target.value })}
              placeholder="Ej: sin cebolla, bien cocido, alergia a..."
              rows={3}
              className="w-full bg-[#252525] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => setModalObs(null)} className="flex-1 bg-[#252525] text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-[#333] transition">Cancelar</button>
              <button onClick={() => {
                setCart((prev) => {
                  const next = [...prev]
                  next[modalObs.idx] = { ...next[modalObs.idx], observacion: modalObs.valor }
                  return next
                })
                setModalObs(null)
              }} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl py-3 text-sm transition">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductoCard({ prod, cart, onAgregar, onCambiar, conPedido }: {
  prod: Producto; cart: CartItem[]
  onAgregar: () => void; onCambiar: (delta: number) => void; conPedido: boolean
}) {
  const enCart = cart.find((i) => i.productoId === prod.id)

  return (
    <div className={`flex gap-3 bg-[#181818] border border-[#252525] rounded-2xl overflow-hidden ${prod.agotado ? 'opacity-50' : ''}`}>
      {/* Imagen */}
      <div className="relative w-[90px] flex-shrink-0 bg-[#252525] min-h-[90px]">
        {prod.imagen_url
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover absolute inset-0" />
          : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🍽️</div>
        }
        {prod.agotado && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-[10px] font-bold text-red-300 bg-red-950/80 border border-red-800 px-2 py-0.5 rounded-md">AGOTADO</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-between">
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{prod.nombre}</p>
          {prod.descripcion && (
            <p className="text-xs text-[#777] mt-0.5 leading-snug line-clamp-2">{prod.descripcion}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-orange-500">${prod.precio.toLocaleString()}</p>
          {conPedido && !prod.agotado && (
            enCart ? (
              <div className="flex items-center gap-2">
                <button onClick={() => onCambiar(-1)}
                  className="w-7 h-7 rounded-lg bg-[#252525] hover:bg-[#333] text-white flex items-center justify-center text-base font-bold transition">−</button>
                <span className="text-sm font-bold text-white w-4 text-center">{enCart.cantidad}</span>
                <button onClick={onAgregar}
                  className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center text-base font-bold transition">+</button>
              </div>
            ) : (
              <button onClick={onAgregar}
                className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition">
                + Agregar
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
