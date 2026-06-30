'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Producto { id: string; nombre: string; precio: number; categoria_id: string; descripcion: string | null }
interface Categoria { id: string; nombre: string; orden: number }
interface ConfigLocal { nombre_negocio: string; logo_url: string | null }

interface ItemCarrito {
  producto_id: string; nombre: string; precio: number; cantidad: number; subtotal: number; observacion: string
}

type Paso = 'menu' | 'carrito' | 'datos' | 'confirmado'

export default function DeliveryPublicoPage() {
  const params = useParams()
  const localId = params.localId as string

  const [configLocal, setConfigLocal] = useState<ConfigLocal | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [catSelec, setCatSelec] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [paso, setPaso] = useState<Paso>('menu')
  const [cliente, setCliente] = useState({ nombre: '', tel: '', dir: '', obs: '' })
  const [retiraEnLocal, setRetiraEnLocal] = useState(false)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'debito' | 'credito'>('efectivo')
  const [enviando, setEnviando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [obsModal, setObsModal] = useState<string | null>(null) // producto_id con modal obs abierto
  const [obsTemp, setObsTemp] = useState('')

  useEffect(() => {
    if (!localId) return
    Promise.all([
      supabaseAnon.from('config_local').select('nombre_negocio, logo_url').eq('local_id', localId).single(),
      supabaseAnon.from('categorias').select('id, nombre, orden').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseAnon.from('productos').select('id, nombre, precio, categoria_id, descripcion').eq('local_id', localId).eq('activo', true).order('nombre'),
    ]).then(([{ data: cfg }, { data: cats }, { data: prods }]) => {
      setConfigLocal(cfg)
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setCatSelec(cats?.[0]?.id ?? '')
      setLoading(false)
    })
  }, [localId])

  const agregar = (p: Producto) => {
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id)
      if (idx >= 0) {
        const c = [...prev]
        c[idx] = { ...c[idx], cantidad: c[idx].cantidad + 1, subtotal: (c[idx].cantidad + 1) * c[idx].precio }
        return c
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, subtotal: p.precio, observacion: '' }]
    })
  }

  const quitar = (productoId: string) => {
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === productoId)
      if (idx < 0) return prev
      const c = [...prev]
      if (c[idx].cantidad > 1) {
        c[idx] = { ...c[idx], cantidad: c[idx].cantidad - 1, subtotal: (c[idx].cantidad - 1) * c[idx].precio }
        return c
      }
      return c.filter((_, i) => i !== idx)
    })
  }

  const guardarObservacion = () => {
    if (!obsModal) return
    setCarrito((prev) => prev.map((i) => i.producto_id === obsModal ? { ...i, observacion: obsTemp } : i))
    setObsModal(null)
  }

  const total = carrito.reduce((s, i) => s + i.subtotal, 0)
  const cantTotal = carrito.reduce((s, i) => s + i.cantidad, 0)

  const enviarPedido = async () => {
    if (!cliente.nombre.trim() || !cliente.tel.trim() || (!retiraEnLocal && !cliente.dir.trim())) return
    setEnviando(true)
    const res = await fetch('/api/public/delivery-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId,
        cliente: {
          nombre: cliente.nombre.trim(),
          tel: cliente.tel.trim(),
          dir: cliente.dir.trim(),
          obs: cliente.obs.trim() || null,
        },
        carrito,
        total,
        metodoPago,
        retiraEnLocal,
      }),
    })
    setEnviando(false)
    if (!res.ok) {
      const { error } = await res.json()
      alert(error ?? 'Error al enviar el pedido. Intentá de nuevo.')
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

  if (paso === 'confirmado') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-5">🛵</div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Pedido recibido!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Te vamos a contactar al <strong className="text-white">{cliente.tel}</strong> para confirmar el pedido y coordinar la entrega.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left space-y-1 mb-6">
            {carrito.map((i) => (
              <div key={i.producto_id} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.cantidad}× {i.nombre}</span>
                <span className="text-white">${i.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-white border-t border-gray-800 pt-2 mt-2">
              <span>Total</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={() => { setCarrito([]); setCliente({ nombre: '', tel: '', dir: '', obs: '' }); setPaso('menu') }}
            className="text-sm text-violet-400 hover:text-violet-300 transition"
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        {configLocal?.logo_url
          ? <img src={configLocal.logo_url} alt="logo" className="w-10 h-10 rounded-xl object-contain bg-gray-800 p-0.5" />
          : <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-xl">🍽️</div>}
        <div className="flex-1">
          <p className="font-bold text-white">{configLocal?.nombre_negocio}</p>
          <p className="text-xs text-gray-500">Delivery 🛵</p>
        </div>
        {paso === 'menu' && carrito.length > 0 && (
          <button
            onClick={() => setPaso('carrito')}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2 text-sm transition"
          >
            🛒 <span>{cantTotal}</span>
            <span className="hidden sm:inline">· ${total.toLocaleString()}</span>
          </button>
        )}
        {paso !== 'menu' && (
          <button onClick={() => setPaso(paso === 'datos' ? 'carrito' : 'menu')} className="text-gray-400 hover:text-white transition text-sm">
            ← Volver
          </button>
        )}
      </div>

      {/* PASO: MENÚ */}
      {paso === 'menu' && (
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Tabs categorías */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatSelec(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition
                  ${catSelec === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {productos.filter((p) => p.categoria_id === catSelec).map((p) => {
              const item = carrito.find((i) => i.producto_id === p.id)
              return (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.descripcion}</p>}
                    <p className="text-sm font-semibold text-violet-400 mt-1">${p.precio.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item ? (
                      <>
                        <button onClick={() => quitar(p.id)} className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition">−</button>
                        <span className="text-sm font-bold text-white w-5 text-center">{item.cantidad}</span>
                        <button onClick={() => agregar(p)} className="w-8 h-8 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition">+</button>
                      </>
                    ) : (
                      <button onClick={() => agregar(p)} className="w-8 h-8 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition">+</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {carrito.length > 0 && (
            <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-10">
              <button
                onClick={() => setPaso('carrito')}
                className="w-full max-w-lg bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl py-4 shadow-2xl transition flex items-center justify-between px-6"
              >
                <span className="bg-violet-500 rounded-xl px-2 py-0.5 text-sm">{cantTotal}</span>
                <span>Ver pedido</span>
                <span>${total.toLocaleString()}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* PASO: CARRITO */}
      {paso === 'carrito' && (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Tu pedido</h2>
          {carrito.map((i) => (
            <div key={i.producto_id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-white">{i.nombre}</p>
                  <p className="text-sm text-violet-400">${i.subtotal.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => quitar(i.producto_id)} className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition">−</button>
                  <span className="text-sm font-bold text-white w-5 text-center">{i.cantidad}</span>
                  <button onClick={() => agregar({ id: i.producto_id, nombre: i.nombre, precio: i.precio, categoria_id: '', descripcion: null })} className="w-8 h-8 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition">+</button>
                </div>
              </div>
              <button
                onClick={() => { setObsModal(i.producto_id); setObsTemp(i.observacion) }}
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                {i.observacion ? `📝 ${i.observacion}` : '+ Agregar nota'}
              </button>
            </div>
          ))}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Total</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => setPaso('datos')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl py-4 transition"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* PASO: DATOS DEL CLIENTE */}
      {paso === 'datos' && (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Tus datos</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nombre y apellido *</label>
              <input
                value={cliente.nombre}
                onChange={(e) => setCliente((c) => ({ ...c, nombre: e.target.value }))}
                placeholder="Juan García"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Teléfono *</label>
              <input
                type="tel"
                value={cliente.tel}
                onChange={(e) => setCliente((c) => ({ ...c, tel: e.target.value }))}
                placeholder="2235001234"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Dirección de entrega *</label>
              {retiraEnLocal ? (
                <div className="w-full bg-gray-800 border border-violet-600 text-violet-400 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                  <span>🥡 Retiro en el local</span>
                  <button onClick={() => setRetiraEnLocal(false)} className="text-gray-500 hover:text-gray-300 text-xs transition">cambiar</button>
                </div>
              ) : (
                <input
                  value={cliente.dir}
                  onChange={(e) => setCliente((c) => ({ ...c, dir: e.target.value }))}
                  placeholder="Calle 123, piso 2 dpto A"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              )}
              {!retiraEnLocal && (
                <button
                  onClick={() => { setRetiraEnLocal(true); setCliente((c) => ({ ...c, dir: '' })) }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition mt-1.5"
                >
                  🥡 Prefiero retirar en el local
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Observaciones (opcional)</label>
              <input
                value={cliente.obs}
                onChange={(e) => setCliente((c) => ({ ...c, obs: e.target.value }))}
                placeholder="Sin cebolla, tocar timbre 3B..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {(['efectivo', 'transferencia', 'debito', 'credito'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`py-3 rounded-xl text-sm font-medium transition border
                    ${metodoPago === m ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                >
                  {{ efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito' }[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
            {carrito.map((i) => (
              <div key={i.producto_id} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.cantidad}× {i.nombre}</span>
                <span className="text-white">${i.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold text-white border-t border-gray-800 pt-2 mt-2">
              <span>Total</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={enviarPedido}
            disabled={!cliente.nombre.trim() || !cliente.tel.trim() || (!retiraEnLocal && !cliente.dir.trim()) || enviando}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold rounded-2xl py-4 transition"
          >
            {enviando ? 'Enviando...' : `Confirmar pedido · $${total.toLocaleString()}`}
          </button>
        </div>
      )}

      {/* Modal observación ítem */}
      {obsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-lg">
            <p className="text-sm font-semibold text-white mb-3">Nota para este ítem</p>
            <input
              autoFocus
              value={obsTemp}
              onChange={(e) => setObsTemp(e.target.value)}
              placeholder="Ej: sin salsa, bien cocido..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              onKeyDown={(e) => e.key === 'Enter' && guardarObservacion()}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setObsModal(null)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm">Cancelar</button>
              <button onClick={guardarObservacion} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 text-sm">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
