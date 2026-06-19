'use client'
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Producto {
  id: string
  nombre: string
  precio: number
  categoria_id: string | null
  imagen_url: string | null
  agotado: boolean
}

interface Categoria {
  id: string
  nombre: string
}

interface ItemCarrito {
  producto_id: string
  nombre: string
  precio: number
  cantidad: number
}

type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

const METODOS: { value: MetodoPago; label: string; emoji: string; color: string }[] = [
  { value: 'efectivo', label: 'Efectivo', emoji: '💵', color: 'bg-green-600 hover:bg-green-500' },
  { value: 'transferencia', label: 'Transferencia', emoji: '📲', color: 'bg-blue-600 hover:bg-blue-500' },
  { value: 'debito', label: 'Débito', emoji: '💳', color: 'bg-violet-600 hover:bg-violet-500' },
  { value: 'credito', label: 'Crédito', emoji: '💳', color: 'bg-amber-600 hover:bg-amber-500' },
]

interface VentaHistorial {
  id: string
  total: number
  metodo_pago: string
  origen: string | null
  created_at: string
  items_venta: { nombre: string; cantidad: number; subtotal: number }[]
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transf.', debito: 'Débito', credito: 'Crédito',
}

export default function VentasPage() {
  const { localId, nombreUsuario } = useSession()
  const [tab, setTab] = useState<'venta' | 'historial'>('venta')
  const [cajaVerificada, setCajaVerificada] = useState<boolean | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [catActiva, setCatActiva] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [exito, setExito] = useState(false)
  const [historial, setHistorial] = useState<VentaHistorial[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [carritoAbierto, setCarritoAbierto] = useState(false)

  const cargarHistorial = async () => {
    setLoadingHistorial(true)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const { data } = await supabaseApp
      .from('ventas')
      .select('id, total, metodo_pago, origen, created_at, items_venta(nombre, cantidad, subtotal)')
      .eq('local_id', localId)
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)
    setHistorial(data ?? [])
    setLoadingHistorial(false)
  }

  useEffect(() => {
    if (tab === 'historial' && localId) cargarHistorial()
  }, [tab, localId])

  useEffect(() => {
    if (!localId) return
    Promise.all([
      supabaseApp.from('categorias').select('id, nombre').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseApp.from('productos').select('id, nombre, precio, categoria_id, imagen_url, agotado').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('caja').select('id').eq('local_id', localId).eq('estado', 'abierta').maybeSingle(),
    ]).then(([{ data: cats }, { data: prods }, { data: caja }]) => {
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setCajaVerificada(!!caja)
    })
  }, [localId])

  const agregar = (p: Producto) => {
    if (p.agotado) return
    setCarrito((prev) => {
      const existe = prev.find((i) => i.producto_id === p.id)
      if (existe) return prev.map((i) => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (producto_id: string, delta: number) => {
    setCarrito((prev) =>
      prev.map((i) => i.producto_id === producto_id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)
        .filter((i) => i.cantidad > 0)
    )
  }

  const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

  const cobrar = async (metodo: MetodoPago) => {
    if (carrito.length === 0) return
    setCobrando(true)

    // Buscar caja abierta
    const { data: cajaAbierta } = await supabaseApp
      .from('caja')
      .select('id')
      .eq('local_id', localId)
      .eq('estado', 'abierta')
      .maybeSingle()

    const { data: venta } = await supabaseApp
      .from('ventas')
      .insert({
        local_id: localId,
        caja_id: cajaAbierta?.id ?? null,
        total,
        metodo_pago: metodo,
        estado: 'completada',
      })
      .select('id')
      .single()

    if (venta) {
      await supabaseApp.from('items_venta').insert(
        carrito.map((i) => ({
          venta_id: venta.id,
          producto_id: i.producto_id,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad,
          subtotal: i.precio * i.cantidad,
        }))
      )
    }

    Sentry.addBreadcrumb({ category: 'ventas', message: 'venta cerrada', data: { metodo, total }, level: 'info' })

    setCarrito([])
    setCobrando(false)
    setExito(true)
    setTimeout(() => setExito(false), 2000)
  }

  const productosFiltrados = productos.filter((p) => {
    const porCat = catActiva === 'todas' || p.categoria_id === catActiva
    const porBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return porCat && porBusqueda
  })

  return (
    <RouteGuard permiso="verVentas">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('venta')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'venta' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          💰 Venta rápida
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'historial' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          📋 Historial de hoy
        </button>
      </div>

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <div className="max-w-2xl">
          {loadingHistorial ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : historial.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">📋</p>
              <p>No hay ventas registradas hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((v) => (
                <div key={v.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandidoId(expandidoId === v.id ? null : v.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {new Date(v.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-lg">
                        {METODO_LABEL[v.metodo_pago] ?? v.metodo_pago}
                      </span>
                      {v.origen === 'comanda' && <span className="text-xs text-violet-400">Mesa</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">${v.total.toLocaleString()}</span>
                      <span className="text-gray-600 text-xs">{expandidoId === v.id ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expandidoId === v.id && v.items_venta.length > 0 && (
                    <div className="px-5 pb-4 space-y-1 border-t border-gray-800 pt-3">
                      {v.items_venta.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-300">{it.cantidad}× {it.nombre}</span>
                          <span className="text-gray-400">${it.subtotal.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 flex justify-between">
                <span className="text-gray-400 font-medium">Total del día</span>
                <span className="text-xl font-bold text-white">
                  ${historial.reduce((s, v) => s + v.total, 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VENTA RÁPIDA */}
      {tab === 'venta' && cajaVerificada === false && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4 text-center">
          <span className="text-5xl">🏧</span>
          <h2 className="text-xl font-bold text-white">La caja está cerrada</h2>
          <p className="text-gray-400 text-sm">
            {nombreUsuario?.split(' ')[0] ? `${nombreUsuario.split(' ')[0]}, abrí` : 'Abrí'} la caja antes de registrar ventas.
          </p>
          <a href="/caja" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-6 py-3 transition">
            Ir a Caja →
          </a>
        </div>
      )}
      {tab === 'venta' && cajaVerificada && <div className="flex gap-6 h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)]">

        {/* Panel izquierdo — productos */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-white">Venta rápida</h1>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 w-32 md:w-48"
            />
          </div>

          {/* Tabs categorías */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCatActiva('todas')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition
                ${catActiva === 'todas' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatActiva(c.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition
                  ${catActiva === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Grid productos */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {productosFiltrados.map((p) => {
                const enCarrito = carrito.find((i) => i.producto_id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => agregar(p)}
                    disabled={p.agotado}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition
                      ${p.agotado
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                        : enCarrito
                          ? 'bg-violet-950 border-violet-600'
                          : 'bg-gray-900 border-gray-800 hover:border-gray-600 active:scale-95'}`}
                  >
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center text-2xl">🍔</div>
                    )}
                    <p className="text-xs font-medium text-white leading-tight line-clamp-2">{p.nombre}</p>
                    <p className="text-sm font-bold text-violet-400">${p.precio.toLocaleString()}</p>
                    {enCarrito && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {enCarrito.cantidad}
                      </div>
                    )}
                    {p.agotado && (
                      <span className="absolute top-1 left-1 bg-red-900 text-red-300 text-xs px-1.5 py-0.5 rounded-lg">Agotado</span>
                    )}
                  </button>
                )
              })}
              {productosFiltrados.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-16">
                  <p className="text-4xl mb-3">🔍</p>
                  <p>No hay productos</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho — carrito (solo desktop) */}
        <div className="hidden md:flex w-72 flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-bold text-white">Detalle de venta</h2>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {carrito.length === 0 ? (
              <p className="text-gray-500 text-sm text-center pt-8">Seleccioná productos</p>
            ) : (
              carrito.map((item) => (
                <div key={item.producto_id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-400">${item.precio.toLocaleString()} c/u</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => cambiarCantidad(item.producto_id, -1)}
                      className="w-6 h-6 rounded-lg bg-gray-800 text-white flex items-center justify-center text-sm hover:bg-gray-700"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium text-white w-4 text-center">{item.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(item.producto_id, 1)}
                      className="w-6 h-6 rounded-lg bg-gray-800 text-white flex items-center justify-center text-sm hover:bg-gray-700"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white w-16 text-right shrink-0">
                    ${(item.precio * item.cantidad).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Total y cobro */}
          <div className="p-4 border-t border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
            </div>

            {exito && (
              <div className="bg-green-950 border border-green-700 text-green-400 rounded-xl p-3 text-sm text-center font-medium">
                ✓ Venta registrada
              </div>
            )}

            {carrito.length > 0 && !exito && (
              <div className="grid grid-cols-2 gap-2">
                {METODOS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => cobrar(m.value)}
                    disabled={cobrando}
                    className={`${m.color} disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-1.5`}
                  >
                    <span>{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {carrito.length === 0 && !exito && (
              <button disabled className="w-full bg-gray-800 text-gray-500 font-semibold rounded-xl py-3 text-sm cursor-not-allowed">
                Seleccioná productos
              </button>
            )}
          </div>
        </div>
      </div>}

      {/* ── MOBILE: botón flotante carrito ── */}
      {tab === 'venta' && carrito.length > 0 && !exito && (
        <div className="fixed bottom-20 left-4 right-4 z-30 md:hidden">
          <button
            onClick={() => setCarritoAbierto(true)}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 shadow-xl"
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {carrito.reduce((s, i) => s + i.cantidad, 0)}
              </span>
              Ver carrito
            </span>
            <span className="font-bold">${total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* ── MOBILE: drawer carrito ── */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCarritoAbierto(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-gray-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="font-bold text-white">Detalle de venta</h2>
              <button onClick={() => setCarritoAbierto(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrito.map((item) => (
                <div key={item.producto_id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-400">${item.precio.toLocaleString()} c/u</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => cambiarCantidad(item.producto_id, -1)} className="w-7 h-7 rounded-lg bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700">−</button>
                    <span className="text-sm font-medium text-white w-5 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(item.producto_id, 1)} className="w-7 h-7 rounded-lg bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700">+</button>
                  </div>
                  <p className="text-sm font-semibold text-white w-16 text-right shrink-0">${(item.precio * item.cantidad).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-800 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-medium">Total</span>
                <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
              </div>
              {exito ? (
                <div className="bg-green-950 border border-green-700 text-green-400 rounded-xl p-3 text-sm text-center font-medium">✓ Venta registrada</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => { cobrar(m.value); setCarritoAbierto(false) }}
                      disabled={cobrando}
                      className={`${m.color} disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-1.5`}
                    >
                      <span>{m.emoji}</span>{m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </RouteGuard>
  )
}
