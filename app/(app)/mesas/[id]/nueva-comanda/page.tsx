'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Categoria { id: string; nombre: string }
interface Producto { id: string; nombre: string; precio: number; categoria_id: string | null; agotado: boolean }
interface CartItem { productoId: string; nombre: string; precio: number; cantidad: number; observacion: string }

export default function NuevaComandaPage() {
  const { localId } = useSession()
  const router = useRouter()
  const params = useParams()
  const mesaId = params.id as string

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [mesaNombre, setMesaNombre] = useState('')
  const [comandaExistente, setComandaExistente] = useState<{ id: string; tanda_actual: number } | null>(null)
  const [tabActivo, setTabActivo] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [vistaCarrito, setVistaCarrito] = useState(false)
  const [modalObs, setModalObs] = useState<number | null>(null) // idx en cart
  const [obsVal, setObsVal] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mesaId || !localId) return
    Promise.all([
      supabaseApp.from('mesas').select('nombre').eq('id', mesaId).single(),
      supabaseApp.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('productos').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
      supabaseApp.from('comandas').select('id, tanda_actual').eq('mesa_id', mesaId).eq('estado', 'abierta').maybeSingle(),
    ]).then(([{ data: m }, { data: cats }, { data: prods }, { data: cmd }]) => {
      setMesaNombre(m?.nombre ?? '')
      setCategorias(cats ?? [])
      setProductos(prods ?? [])
      setComandaExistente(cmd)
      setLoading(false)
    })
  }, [mesaId, localId])

  const productosFiltrados = useMemo(() => {
    let list = productos.filter((p) => !p.agotado)
    if (tabActivo !== 'todos') list = list.filter((p) => p.categoria_id === tabActivo)
    if (busqueda) list = list.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    return list
  }, [productos, tabActivo, busqueda])

  const agregarAlCart = (prod: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productoId === prod.id && !i.observacion)
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
  const cantItems = cart.reduce((s, i) => s + i.cantidad, 0)

  const confirmarPedido = async () => {
    if (cart.length === 0) return
    setGuardando(true)

    let comandaId = comandaExistente?.id
    let tanda = (comandaExistente?.tanda_actual ?? 0) + 1

    if (!comandaId) {
      const { data: nuevaComanda } = await supabaseApp
        .from('comandas')
        .insert({ local_id: localId, mesa_id: mesaId, tanda_actual: 1, total: 0 })
        .select('id').single()
      comandaId = nuevaComanda?.id
      tanda = 1
      await supabaseApp.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)
    } else {
      await supabaseApp.from('comandas').update({ tanda_actual: tanda }).eq('id', comandaId)
    }

    if (!comandaId) { setGuardando(false); return }

    await supabaseApp.from('items_comanda').insert(
      cart.map((i) => ({
        comanda_id: comandaId,
        producto_id: i.productoId,
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
        subtotal: i.precio * i.cantidad,
        observacion: i.observacion || null,
        tanda,
        estado: 'pendiente',
      }))
    )

    const { data: todosItems } = await supabaseApp.from('items_comanda').select('subtotal').eq('comanda_id', comandaId)
    const nuevoTotal = (todosItems ?? []).reduce((s, i) => s + Number(i.subtotal), 0)
    await supabaseApp.from('comandas').update({ total: nuevoTotal }).eq('id', comandaId)

    setGuardando(false)
    router.push(`/mesas/${mesaId}`)
  }

  if (loading) {
    return (
      <RouteGuard permiso="crearComandas">
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard permiso="crearComandas">
      {/* ── VISTA CARRITO (mobile paso 2 / siempre visible en desktop como panel lateral) ── */}
      {vistaCarrito ? (
        <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-4rem)]">
          <div className="flex items-center gap-3 mb-4 flex-shrink-0">
            <button onClick={() => setVistaCarrito(false)} className="text-gray-400 hover:text-white transition">← Seguir eligiendo</button>
            <div>
              <h1 className="text-xl font-bold text-white">Pedido</h1>
              <p className="text-xs text-gray-500">{mesaNombre}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pb-2">
            {cart.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-16">Volvé y elegí productos</p>
            ) : cart.map((item, idx) => (
              <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-white flex-1">{item.nombre}</span>
                  <span className="text-sm font-bold text-white">${(item.precio * item.cantidad).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => cambiarCantidad(idx, -1)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition text-lg">−</button>
                    <span className="text-base font-bold text-white w-5 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(idx, 1)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition text-lg">+</button>
                  </div>
                  <button
                    onClick={() => { setModalObs(idx); setObsVal(item.observacion) }}
                    className={`text-xs transition px-2 py-1 rounded-lg ${item.observacion ? 'bg-amber-950 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {item.observacion ? `"${item.observacion.slice(0, 18)}..."` : '+ aclaración'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 pt-3 border-t border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total</span>
              <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
            </div>
            <button
              onClick={confirmarPedido}
              disabled={cart.length === 0 || guardando}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition"
            >
              {guardando ? 'Enviando...' : 'Confirmar pedido →'}
            </button>
          </div>
        </div>
      ) : (
        /* ── VISTA PRODUCTOS ── */
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">←</button>
              <div>
                <h1 className="text-lg font-bold text-white">{comandaExistente ? 'Agregar pedido' : 'Nueva comanda'}</h1>
                <p className="text-xs text-gray-500">{mesaNombre}</p>
              </div>
            </div>
            {/* Botón carrito — siempre visible si hay items */}
            {cart.length > 0 && (
              <button
                onClick={() => setVistaCarrito(true)}
                className="relative bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2 text-sm transition"
              >
                Ver pedido
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {cantItems}
                </span>
              </button>
            )}
          </div>

          {/* Buscador */}
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="mb-3 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 flex-shrink-0"
          />

          {/* Tabs categorías */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide">
            <button
              onClick={() => setTabActivo('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                ${tabActivo === 'todos' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setTabActivo(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition
                  ${tabActivo === c.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Grid productos — toca para agregar, muestra contador si ya está en el carrito */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-24">
              {productosFiltrados.map((p) => {
                const enCart = cart.find((i) => i.productoId === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCart(p)}
                    className={`relative bg-gray-900 border rounded-xl p-3 text-left transition active:scale-95
                      ${enCart ? 'border-violet-600 bg-violet-950/20' : 'border-gray-800 hover:border-violet-600'}`}
                  >
                    {enCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-violet-600 rounded-full text-xs text-white flex items-center justify-center font-bold">
                        {enCart.cantidad}
                      </span>
                    )}
                    <p className="text-sm font-medium text-white leading-snug pr-6">{p.nombre}</p>
                    <p className="text-sm font-bold text-violet-400 mt-1">${p.precio.toLocaleString()}</p>
                  </button>
                )
              })}
              {productosFiltrados.length === 0 && (
                <p className="col-span-full text-gray-600 text-sm text-center py-8">Sin productos</p>
              )}
            </div>
          </div>

          {/* Botón flotante inferior cuando hay items */}
          {cart.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent pointer-events-none">
              <div className="max-w-lg mx-auto pointer-events-auto">
                <button
                  onClick={() => setVistaCarrito(true)}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 transition shadow-xl"
                >
                  <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">{cantItems}</span>
                  <span>Ver pedido</span>
                  <span className="font-bold">${total.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal observación */}
      {modalObs !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-lg shadow-xl">
            <h3 className="font-bold text-white mb-1">Aclaración</h3>
            <p className="text-xs text-gray-400 mb-3">{cart[modalObs]?.nombre}</p>
            <textarea
              value={obsVal}
              onChange={(e) => setObsVal(e.target.value)}
              placeholder="Ej: sin cebolla, bien cocido, alergia a..."
              rows={3}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => setModalObs(null)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">Cancelar</button>
              <button
                onClick={() => {
                  if (modalObs === null) return
                  setCart((prev) => { const next = [...prev]; next[modalObs] = { ...next[modalObs], observacion: obsVal }; return next })
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
    </RouteGuard>
  )
}
