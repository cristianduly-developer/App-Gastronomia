'use client'
import { useEffect, useState, useCallback } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { PlanGuard } from '@/components/PlanGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Producto { id: string; nombre: string; precio: number; categoria_id: string }
interface Categoria { id: string; nombre: string }

interface ItemForm { producto_id: string; nombre: string; precio: number; cantidad: number; subtotal: number; observacion: string }

interface PedidoDelivery {
  id: string
  cliente_nombre: string
  cliente_tel: string
  cliente_dir: string
  observaciones: string | null
  total: number
  metodo_pago: string
  estado: 'recibido' | 'en_cocina' | 'en_camino' | 'entregado' | 'cancelado'
  origen: 'link' | 'manual'
  created_at: string
  items?: { nombre: string; cantidad: number; subtotal: number; observacion: string | null }[]
}

const ESTADOS = [
  { key: 'recibido',   label: 'Recibido',    color: 'border-yellow-600', badge: 'bg-yellow-900 text-yellow-300', dot: 'bg-yellow-500' },
  { key: 'en_cocina',  label: 'En cocina',   color: 'border-blue-600',   badge: 'bg-blue-900 text-blue-300',     dot: 'bg-blue-500' },
  { key: 'en_camino',  label: 'En camino',   color: 'border-violet-600', badge: 'bg-violet-900 text-violet-300', dot: 'bg-violet-500' },
  { key: 'entregado',  label: 'Entregado',   color: 'border-green-600',  badge: 'bg-green-900 text-green-300',   dot: 'bg-green-500' },
] as const

type EstadoKey = typeof ESTADOS[number]['key']

const SIGUIENTE: Record<EstadoKey, EstadoKey | null> = {
  recibido:  'en_cocina',
  en_cocina: 'en_camino',
  en_camino: 'entregado',
  entregado:  null,
}

const SIGUIENTE_LABEL: Record<EstadoKey, string> = {
  recibido:  'Pasar a cocina',
  en_cocina: 'En camino',
  en_camino: 'Entregado',
  entregado: '',
}

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito',
}

function tiempoDesde(created_at: string) {
  const mins = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function DeliveryPage() {
  const { localId } = useSession()
  const [pedidos, setPedidos] = useState<PedidoDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [avanzando, setAvanzando] = useState<Set<string>>(new Set())

  // Modal nuevo pedido manual
  const [modalNuevo, setModalNuevo] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [catSelec, setCatSelec] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [cliente, setCliente] = useState({ nombre: '', tel: '', dir: '', obs: '' })
  const [retiraEnLocal, setRetiraEnLocal] = useState(false)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'debito' | 'credito'>('efectivo')
  const [guardando, setGuardando] = useState(false)
  const [clienteSugerido, setClienteSugerido] = useState<{ id: string; nombre: string; telefono: string; observaciones: string | null } | null>(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabaseApp
      .from('pedidos_delivery')
      .select(`*, items_pedido_delivery(nombre, cantidad, subtotal, observacion)`)
      .eq('local_id', localId)
      .not('estado', 'eq', 'cancelado')
      .not('estado', 'eq', 'entregado')
      .order('created_at', { ascending: false })
    setPedidos((data ?? []).map((p: any) => ({ ...p, items: p.items_pedido_delivery })))
    setLoading(false)
  }, [localId])

  useEffect(() => {
    if (!localId) return
    cargar()
    const ch = supabaseApp
      .channel('delivery-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_delivery', filter: `local_id=eq.${localId}` }, cargar)
      .subscribe()
    return () => { supabaseApp.removeChannel(ch) }
  }, [localId, cargar])

  const avanzar = async (pedido: PedidoDelivery) => {
    const sig = SIGUIENTE[pedido.estado as EstadoKey]
    if (!sig) return
    setAvanzando((s) => new Set(s).add(pedido.id))
    await supabaseApp.from('pedidos_delivery').update({ estado: sig }).eq('id', pedido.id)
    setAvanzando((s) => { const n = new Set(s); n.delete(pedido.id); return n })
    cargar()
  }

  const cancelar = async (id: string) => {
    if (!confirm('¿Cancelar este pedido?')) return
    await supabaseApp.from('pedidos_delivery').update({ estado: 'cancelado' }).eq('id', id)
    cargar()
  }

  const buscarClientePorTel = async (tel: string) => {
    setClienteSugerido(null)
    if (tel.length < 6) return
    setBuscandoCliente(true)
    const { data } = await supabaseApp
      .from('clientes')
      .select('id, nombre, telefono, observaciones')
      .eq('local_id', localId)
      .eq('activo', true)
      .ilike('telefono', `%${tel}%`)
      .limit(1)
      .maybeSingle()
    setClienteSugerido(data ?? null)
    setBuscandoCliente(false)
  }

  const aplicarClienteSugerido = () => {
    if (!clienteSugerido) return
    setCliente((c) => ({
      ...c,
      nombre: clienteSugerido.nombre,
      tel: clienteSugerido.telefono ?? c.tel,
      obs: clienteSugerido.observaciones ?? c.obs,
    }))
    setClienteSugerido(null)
  }

  // Cargar carta para modal manual
  const abrirModalNuevo = async () => {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabaseApp.from('categorias').select('id, nombre').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseApp.from('productos').select('id, nombre, precio, categoria_id').eq('local_id', localId).eq('activo', true).order('nombre'),
    ])
    setCategorias(cats ?? [])
    setProductos(prods ?? [])
    setCatSelec(cats?.[0]?.id ?? '')
    setItems([])
    setCliente({ nombre: '', tel: '', dir: '', obs: '' })
    setRetiraEnLocal(false)
    setMetodoPago('efectivo')
    setClienteSugerido(null)
    setModalNuevo(true)
  }

  const agregarProducto = (p: Producto) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id)
      if (idx >= 0) {
        const copia = [...prev]
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1, subtotal: (copia[idx].cantidad + 1) * copia[idx].precio }
        return copia
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, subtotal: p.precio, observacion: '' }]
    })
  }

  const quitarProducto = (productoId: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === productoId)
      if (idx < 0) return prev
      const copia = [...prev]
      if (copia[idx].cantidad > 1) {
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad - 1, subtotal: (copia[idx].cantidad - 1) * copia[idx].precio }
        return copia
      }
      return copia.filter((_, i) => i !== idx)
    })
  }

  const totalPedido = items.reduce((s, i) => s + i.subtotal, 0)

  const guardarPedido = async () => {
    if (!cliente.nombre.trim() || !cliente.tel.trim() || (!retiraEnLocal && !cliente.dir.trim()) || items.length === 0) return
    setGuardando(true)
    const { data: pedido, error } = await supabaseApp.from('pedidos_delivery').insert({
      local_id: localId,
      cliente_nombre: cliente.nombre.trim(),
      cliente_tel: cliente.tel.trim(),
      cliente_dir: retiraEnLocal ? 'Retira en el local' : cliente.dir.trim(),
      observaciones: cliente.obs.trim() || null,
      total: totalPedido,
      metodo_pago: metodoPago,
      estado: 'recibido',
      origen: 'manual',
    }).select().single()

    if (error || !pedido) {
      alert(`Error al guardar el pedido: ${error?.message ?? 'sin respuesta'}`)
      setGuardando(false)
      return
    }

    const { error: errorItems } = await supabaseApp.from('items_pedido_delivery').insert(
      items.map((i) => ({
        pedido_delivery_id: pedido.id,
        producto_id: i.producto_id,
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
        subtotal: i.subtotal,
        observacion: i.observacion || null,
      }))
    )

    if (errorItems) {
      alert(`Error al guardar los items: ${errorItems.message}`)
    }

    // Guardar/actualizar cliente
    if (cliente.tel.trim()) {
      const { data: clienteExistente } = await supabaseApp
        .from('clientes')
        .select('id')
        .eq('local_id', localId)
        .eq('telefono', cliente.tel.trim())
        .maybeSingle()
      if (clienteExistente) {
        await supabaseApp.from('clientes').update({
          nombre: cliente.nombre.trim(),
          observaciones: cliente.obs.trim() || null,
        }).eq('id', clienteExistente.id)
      } else {
        await supabaseApp.from('clientes').insert({
          local_id: localId,
          nombre: cliente.nombre.trim(),
          telefono: cliente.tel.trim(),
          observaciones: cliente.obs.trim() || null,
        })
      }
    }

    setGuardando(false)
    setModalNuevo(false)
    cargar()
  }

  const pedidosPorEstado = (estado: EstadoKey) => pedidos.filter((p) => p.estado === estado)

  return (
    <RouteGuard permiso="verDelivery">
      <PlanGuard feature="usaDelivery">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Delivery</h1>
            <p className="text-xs text-gray-500 mt-0.5">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} activo{pedidos.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={abrirModalNuevo}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
          >
            + Nuevo pedido
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <p className="text-5xl mb-4">🛵</p>
              <p className="text-lg font-medium text-gray-400">Sin pedidos activos</p>
              <p className="text-sm mt-1">Los pedidos del link y los manuales aparecen acá</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
            {ESTADOS.map((col) => {
              const colPedidos = pedidosPorEstado(col.key)
              return (
                <div key={col.key} className={`flex flex-col border-t-2 ${col.color} bg-gray-900/50 rounded-2xl overflow-hidden`}>
                  <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-sm font-semibold text-white">{col.label}</span>
                    </div>
                    {colPedidos.length > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${col.badge}`}>{colPedidos.length}</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {colPedidos.length === 0 ? (
                      <p className="text-gray-700 text-sm text-center py-6">—</p>
                    ) : colPedidos.map((p) => (
                      <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-violet-400">{p.cliente_nombre}</span>
                          <span className="text-xs text-gray-600">{tiempoDesde(p.created_at)}</span>
                        </div>

                        {/* Dirección */}
                        {p.cliente_dir === 'Retira en el local'
                          ? <span className="text-xs text-violet-400">🥡 Retira en el local</span>
                          : <p className="text-xs text-gray-400 leading-snug">{p.cliente_dir}</p>
                        }

                        {/* Tel + llamar */}
                        <a
                          href={`tel:${p.cliente_tel}`}
                          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition"
                        >
                          📞 {p.cliente_tel}
                        </a>

                        {/* Items (expandible) */}
                        <button
                          onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                          className="text-xs text-gray-500 hover:text-gray-300 transition"
                        >
                          {expandido === p.id ? '▲ Ocultar' : `▼ Ver ${p.items?.length ?? 0} ítem${(p.items?.length ?? 0) !== 1 ? 's' : ''}`}
                        </button>

                        {expandido === p.id && p.items && (
                          <div className="space-y-1 border-t border-gray-800 pt-2">
                            {p.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-gray-300">{it.cantidad}× {it.nombre}</span>
                                <span className="text-gray-400">${it.subtotal.toLocaleString()}</span>
                              </div>
                            ))}
                            {p.observaciones && (
                              <p className="text-xs text-amber-400 italic mt-1">{p.observaciones}</p>
                            )}
                          </div>
                        )}

                        {/* Total + método */}
                        <div className="flex items-center justify-between border-t border-gray-800 pt-2">
                          <span className="text-xs text-gray-500">{METODO_LABELS[p.metodo_pago] ?? p.metodo_pago}</span>
                          <span className="text-sm font-bold text-white">${p.total.toLocaleString()}</span>
                        </div>

                        {/* Origen */}
                        {p.origen === 'link' && (
                          <span className="text-xs text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded-lg">Desde QR</span>
                        )}

                        {/* Acciones */}
                        <div className="flex gap-2 pt-1">
                          {SIGUIENTE[col.key] && (
                            <button
                              onClick={() => avanzar(p)}
                              disabled={avanzando.has(p.id)}
                              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-1.5 transition"
                            >
                              {avanzando.has(p.id) ? '...' : SIGUIENTE_LABEL[col.key]}
                            </button>
                          )}
                          <button
                            onClick={() => cancelar(p.id)}
                            className="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nuevo pedido manual */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">Nuevo pedido delivery</h3>
              <button onClick={() => setModalNuevo(false)} className="text-gray-500 hover:text-white transition text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Datos cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Nombre del cliente</label>
                  <input
                    value={cliente.nombre}
                    onChange={(e) => setCliente((c) => ({ ...c, nombre: e.target.value }))}
                    placeholder="Nombre y apellido"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Teléfono</label>
                  <input
                    type="tel"
                    value={cliente.tel}
                    onChange={(e) => {
                      setCliente((c) => ({ ...c, tel: e.target.value }))
                      buscarClientePorTel(e.target.value)
                    }}
                    placeholder="Ej: 2235001234"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  />
                  {buscandoCliente && (
                    <p className="text-xs text-gray-500 mt-1">Buscando...</p>
                  )}
                  {clienteSugerido && (
                    <button
                      type="button"
                      onClick={aplicarClienteSugerido}
                      className="mt-1.5 w-full flex items-center gap-2 bg-violet-950 border border-violet-700 rounded-xl px-3 py-2 text-left hover:bg-violet-900 transition"
                    >
                      <span className="text-violet-400 text-sm">👤</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-violet-300">{clienteSugerido.nombre}</p>
                        {clienteSugerido.observaciones && (
                          <p className="text-xs text-violet-500 truncate">{clienteSugerido.observaciones}</p>
                        )}
                      </div>
                      <span className="text-xs text-violet-400 flex-shrink-0">Usar →</span>
                    </button>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1.5">Dirección</label>
                  {retiraEnLocal ? (
                    <div className="w-full bg-gray-800 border border-violet-600 text-violet-400 rounded-xl px-3 py-2.5 text-sm flex items-center justify-between">
                      <span>🥡 Retira en el local</span>
                      <button onClick={() => setRetiraEnLocal(false)} className="text-gray-500 hover:text-gray-300 text-xs transition">cambiar</button>
                    </div>
                  ) : (
                    <input
                      value={cliente.dir}
                      onChange={(e) => setCliente((c) => ({ ...c, dir: e.target.value }))}
                      placeholder="Calle y número, piso/depto"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                    />
                  )}
                  {!retiraEnLocal && (
                    <button
                      onClick={() => { setRetiraEnLocal(true); setCliente((c) => ({ ...c, dir: '' })) }}
                      className="text-xs text-violet-400 hover:text-violet-300 transition mt-1.5"
                    >
                      🥡 Retira en el local
                    </button>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1.5">Observaciones (opcional)</label>
                  <input
                    value={cliente.obs}
                    onChange={(e) => setCliente((c) => ({ ...c, obs: e.target.value }))}
                    placeholder="Sin cebolla, tocar timbre..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Carta */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Productos</p>
                {/* Tabs categorías */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {categorias.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCatSelec(c.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition
                        ${catSelec === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {productos.filter((p) => p.categoria_id === catSelec).map((p) => {
                    const item = items.find((i) => i.producto_id === p.id)
                    return (
                      <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{p.nombre}</p>
                          <p className="text-xs text-gray-500">${p.precio.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item ? (
                            <>
                              <button onClick={() => quitarProducto(p.id)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-bold transition">−</button>
                              <span className="text-sm font-semibold text-white w-4 text-center">{item.cantidad}</span>
                              <button onClick={() => agregarProducto(p)} className="w-7 h-7 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition">+</button>
                            </>
                          ) : (
                            <button onClick={() => agregarProducto(p)} className="w-7 h-7 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-bold transition">+</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Carrito resumen */}
              {items.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Resumen del pedido</p>
                  {items.map((i) => (
                    <div key={i.producto_id} className="flex justify-between text-sm">
                      <span className="text-gray-300">{i.cantidad}× {i.nombre}</span>
                      <span className="text-white">${i.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold text-white border-t border-gray-700 pt-2 mt-2">
                    <span>Total</span>
                    <span>${totalPedido.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Método de pago */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['efectivo', 'transferencia', 'debito', 'credito'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition border
                        ${metodoPago === m ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                      {METODO_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex-shrink-0 flex gap-3">
              <button onClick={() => setModalNuevo(false)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button
                onClick={guardarPedido}
                disabled={!cliente.nombre.trim() || !cliente.tel.trim() || (!retiraEnLocal && !cliente.dir.trim()) || items.length === 0 || guardando}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
              >
                {guardando ? 'Guardando...' : `Crear pedido · $${totalPedido.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
      </PlanGuard>
    </RouteGuard>
  )
}
