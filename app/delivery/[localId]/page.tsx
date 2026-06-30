'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Producto { id: string; nombre: string; precio: number; categoria_id: string; descripcion: string | null; imagen_url: string | null }
interface Categoria { id: string; nombre: string; orden: number }
interface ConfigLocal { nombre_negocio: string; logo_url: string | null; telefono: string | null; tipo_negocio: string }
interface ItemCarrito { producto_id: string; nombre: string; precio: number; cantidad: number; subtotal: number; observacion: string }

type Paso = 'menu' | 'carrito' | 'datos' | 'confirmado'

const TIPO_LABELS: Record<string, string> = {
  food_truck: 'Food Truck', rotiseria: 'Rotisería', pizzeria: 'Pizzería',
  restaurante: 'Restaurante', cafeteria: 'Cafetería', otro: 'Gastronomía',
}

export default function DeliveryPublicoPage() {
  const params = useParams()
  const localId = params.localId as string

  const [configLocal, setConfigLocal] = useState<ConfigLocal | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [catSelec, setCatSelec] = useState('todos')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [paso, setPaso] = useState<Paso>('menu')
  const [cliente, setCliente] = useState({ nombre: '', tel: '', dir: '', obs: '' })
  const [retiraEnLocal, setRetiraEnLocal] = useState(false)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'debito' | 'credito'>('efectivo')
  const [enviando, setEnviando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [obsModal, setObsModal] = useState<string | null>(null)
  const [obsTemp, setObsTemp] = useState('')

  useEffect(() => {
    if (!localId) return
    Promise.all([
      supabaseAnon.from('config_local').select('nombre_negocio, logo_url, telefono, tipo_negocio').eq('local_id', localId).single(),
      supabaseAnon.from('categorias').select('id, nombre, orden').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseAnon.from('productos').select('id, nombre, precio, categoria_id, descripcion, imagen_url').eq('local_id', localId).eq('activo', true).order('nombre'),
    ]).then(([{ data: cfg }, { data: cats }, { data: prods }]) => {
      setConfigLocal(cfg)
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
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
        cliente: { nombre: cliente.nombre.trim(), tel: cliente.tel.trim(), dir: cliente.dir.trim(), obs: cliente.obs.trim() || null },
        carrito, total, metodoPago, retiraEnLocal,
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
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (paso === 'confirmado') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-5">🛵</div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Pedido recibido!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Te contactamos al <strong className="text-white">{cliente.tel}</strong> para confirmar.
          </p>
          <div className="bg-[#181818] border border-[#252525] rounded-2xl p-4 text-left space-y-1 mb-6">
            {carrito.map((i) => (
              <div key={i.producto_id} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.cantidad}× {i.nombre}</span>
                <span className="text-white">${i.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-white border-t border-[#252525] pt-2 mt-2">
              <span>Total</span><span>${total.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={() => { setCarrito([]); setCliente({ nombre: '', tel: '', dir: '', obs: '' }); setPaso('menu') }}
            className="text-sm text-orange-400 hover:text-orange-300 transition">
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  const tipoLabel = TIPO_LABELS[configLocal?.tipo_negocio ?? ''] ?? 'Gastronomía'
  const waLink = configLocal?.telefono ? `https://wa.me/549${configLocal.telefono.replace(/\D/g, '')}` : null

  const prodsMostrados = catSelec === 'todos'
    ? productos
    : productos.filter((p) => p.categoria_id === catSelec)

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1e1e1e] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-[#252525] flex items-center justify-center">
              {configLocal?.logo_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={configLocal.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                : <span className="text-2xl">🍽️</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-white text-lg leading-tight truncate">{configLocal?.nombre_negocio}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">{tipoLabel} · Delivery 🛵</span>
              </div>
            </div>
            {paso === 'menu' && carrito.length > 0 && (
              <button onClick={() => setPaso('carrito')}
                className="flex-shrink-0 bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5">
                🛒 {cantTotal}
              </button>
            )}
            {paso !== 'menu' && (
              <button onClick={() => setPaso(paso === 'datos' ? 'carrito' : 'menu')}
                className="flex-shrink-0 text-gray-400 hover:text-white transition text-sm">
                ← Volver
              </button>
            )}
          </div>

          {paso === 'menu' && (configLocal?.telefono || waLink) && (
            <div className="flex gap-2 mt-3">
              {configLocal?.telefono && (
                <a href={`tel:${configLocal.telefono}`}
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
            <button onClick={() => setCatSelec('todos')}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition ${catSelec === 'todos' ? 'bg-orange-500 text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}>
              Todos
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatSelec(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition ${catSelec === c.id ? 'bg-orange-500 text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}>
                {c.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MENÚ */}
      {paso === 'menu' && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-3 pb-32">
          {prodsMostrados.map((p) => {
            const item = carrito.find((i) => i.producto_id === p.id)
            return (
              <div key={p.id} className="flex gap-3 bg-[#181818] border border-[#252525] rounded-2xl overflow-hidden">
                <div className="relative w-[90px] flex-shrink-0 bg-[#252525] min-h-[90px]">
                  {p.imagen_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover absolute inset-0" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🍽️</div>
                  }
                </div>
                <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-[#777] mt-0.5 leading-snug line-clamp-2">{p.descripcion}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-base font-bold text-orange-500">${p.precio.toLocaleString()}</p>
                    {item ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => quitar(p.id)}
                          className="w-7 h-7 rounded-lg bg-[#252525] hover:bg-[#333] text-white flex items-center justify-center text-base font-bold transition">−</button>
                        <span className="text-sm font-bold text-white w-4 text-center">{item.cantidad}</span>
                        <button onClick={() => agregar(p)}
                          className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center text-base font-bold transition">+</button>
                      </div>
                    ) : (
                      <button onClick={() => agregar(p)}
                        className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition">
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {prodsMostrados.length === 0 && (
            <div className="text-center py-20 text-gray-600">
              <p className="text-4xl mb-3">🍽️</p>
              <p>Sin productos</p>
            </div>
          )}

          {carrito.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 z-10">
              <div className="max-w-lg mx-auto">
                <button onClick={() => setPaso('carrito')}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 transition shadow-2xl">
                  <span className="bg-white/20 rounded-xl w-7 h-7 flex items-center justify-center text-sm font-bold">{cantTotal}</span>
                  <span>Ver pedido</span>
                  <span className="font-bold">${total.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CARRITO */}
      {paso === 'carrito' && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          <h2 className="text-lg font-bold text-white">Tu pedido</h2>
          {carrito.map((i) => (
            <div key={i.producto_id} className="bg-[#181818] border border-[#252525] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-white">{i.nombre}</p>
                  <p className="text-sm text-orange-500">${i.subtotal.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => quitar(i.producto_id)} className="w-8 h-8 bg-[#252525] hover:bg-[#333] text-white rounded-xl font-bold transition">−</button>
                  <span className="text-sm font-bold text-white w-5 text-center">{i.cantidad}</span>
                  <button onClick={() => agregar({ id: i.producto_id, nombre: i.nombre, precio: i.precio, categoria_id: '', descripcion: null, imagen_url: null })}
                    className="w-8 h-8 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold transition">+</button>
                </div>
              </div>
              <button onClick={() => { setObsModal(i.producto_id); setObsTemp(i.observacion) }}
                className="text-xs text-gray-500 hover:text-gray-300 transition">
                {i.observacion ? `📝 ${i.observacion}` : '+ Agregar nota'}
              </button>
            </div>
          ))}

          <div className="bg-[#181818] border border-[#252525] rounded-2xl p-4">
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Total</span><span>${total.toLocaleString()}</span>
            </div>
          </div>

          <button onClick={() => setPaso('datos')}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-2xl py-4 transition">
            Continuar con mis datos →
          </button>
        </div>
      )}

      {/* DATOS */}
      {paso === 'datos' && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-8">
          <h2 className="text-lg font-bold text-white">Tus datos</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nombre y apellido *</label>
              <input value={cliente.nombre} onChange={(e) => setCliente((c) => ({ ...c, nombre: e.target.value }))}
                placeholder="Juan García"
                className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Teléfono *</label>
              <input type="tel" value={cliente.tel} onChange={(e) => setCliente((c) => ({ ...c, tel: e.target.value }))}
                placeholder="2235001234"
                className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Dirección de entrega *</label>
              {retiraEnLocal ? (
                <div className="w-full bg-[#1e1e1e] border border-orange-500 text-orange-400 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                  <span>🥡 Retiro en el local</span>
                  <button onClick={() => setRetiraEnLocal(false)} className="text-gray-500 hover:text-gray-300 text-xs transition">cambiar</button>
                </div>
              ) : (
                <input value={cliente.dir} onChange={(e) => setCliente((c) => ({ ...c, dir: e.target.value }))}
                  placeholder="Calle 123, piso 2 dpto A"
                  className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
              )}
              {!retiraEnLocal && (
                <button onClick={() => { setRetiraEnLocal(true); setCliente((c) => ({ ...c, dir: '' })) }}
                  className="text-xs text-orange-400 hover:text-orange-300 transition mt-1.5">
                  🥡 Prefiero retirar en el local
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Observaciones (opcional)</label>
              <input value={cliente.obs} onChange={(e) => setCliente((c) => ({ ...c, obs: e.target.value }))}
                placeholder="Sin cebolla, tocar timbre 3B..."
                className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {(['efectivo', 'transferencia', 'debito', 'credito'] as const).map((m) => (
                <button key={m} onClick={() => setMetodoPago(m)}
                  className={`py-3 rounded-xl text-sm font-medium transition border ${metodoPago === m ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:text-white'}`}>
                  {{ efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito' }[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#181818] border border-[#252525] rounded-2xl p-4 space-y-1">
            {carrito.map((i) => (
              <div key={i.producto_id} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.cantidad}× {i.nombre}</span>
                <span className="text-white">${i.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold text-white border-t border-[#252525] pt-2 mt-2">
              <span>Total</span><span>${total.toLocaleString()}</span>
            </div>
          </div>

          <button onClick={enviarPedido}
            disabled={!cliente.nombre.trim() || !cliente.tel.trim() || (!retiraEnLocal && !cliente.dir.trim()) || enviando}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold rounded-2xl py-4 transition">
            {enviando ? 'Enviando...' : `Confirmar pedido · $${total.toLocaleString()}`}
          </button>
        </div>
      )}

      {/* Modal observación */}
      {obsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-[#181818] border border-[#252525] rounded-2xl p-5 w-full max-w-lg">
            <p className="text-sm font-semibold text-white mb-3">Nota para este ítem</p>
            <input autoFocus value={obsTemp} onChange={(e) => setObsTemp(e.target.value)}
              placeholder="Ej: sin salsa, bien cocido..."
              className="w-full bg-[#252525] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
              onKeyDown={(e) => e.key === 'Enter' && guardarObservacion()} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setObsModal(null)} className="flex-1 bg-[#252525] text-gray-300 font-semibold rounded-xl py-3 text-sm">Cancelar</button>
              <button onClick={guardarObservacion} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl py-3 text-sm">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
