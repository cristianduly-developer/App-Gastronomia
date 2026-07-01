'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Caja {
  id: string
  monto_apertura: number
  monto_cierre: number | null
  diferencia: number | null
  created_at: string
}

interface GastoCaja {
  id: string
  descripcion: string
  monto: number
  created_at: string
}

interface VentaResumen {
  total: number
  metodo_pago: string
  origen: string
}

export default function CajaPage() {
  const { localId } = useSession()
  const router = useRouter()
  const [cajaActual, setCajaActual] = useState<Caja | null>(null)
  const [gastos, setGastos] = useState<GastoCaja[]>([])
  const [ventas, setVentas] = useState<VentaResumen[]>([])
  const [loading, setLoading] = useState(true)

  const [montoApertura, setMontoApertura] = useState('')
  const [montoCierre, setMontoCierre] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [formGasto, setFormGasto] = useState({ descripcion: '', monto: '' })
  const [guardando, setGuardando] = useState(false)
  const [tab, setTab] = useState<'resumen' | 'ventas' | 'gastos'>('resumen')

  useEffect(() => { if (localId) cargarDatos() }, [localId])

  const cargarDatos = async () => {
    setLoading(true)

    // Buscar caja abierta
    const { data: cajaData } = await supabaseApp
      .from('caja')
      .select('*')
      .eq('local_id', localId)
      .eq('estado', 'abierta')
      .maybeSingle()

    setCajaActual(cajaData ?? null)

    if (cajaData) {
      // Gastos de esta caja
      const { data: gastosData } = await supabaseApp
        .from('gastos_caja')
        .select('*')
        .eq('caja_id', cajaData.id)
        .order('created_at', { ascending: false })
      setGastos(gastosData ?? [])

      // Ventas desde que se abrió la caja (con o sin caja_id, por fecha)
      const { data: ventasData } = await supabaseApp
        .from('ventas')
        .select('total, metodo_pago, origen')
        .eq('local_id', localId)
        .eq('estado', 'completada')
        .gte('created_at', cajaData.created_at)
      setVentas(ventasData ?? [])
    } else {
      setGastos([])
      setVentas([])
    }

    setLoading(false)
  }

  const abrirCaja = async () => {
    if (!montoApertura || guardando) return
    setGuardando(true)
    try {
      const { error } = await supabaseApp.from('caja').insert({
        local_id: localId,
        estado: 'abierta',
        monto_apertura: Number(montoApertura),
      })
      if (error) {
        alert(error.code === '23505' ? 'Ya hay una caja abierta' : 'Error al abrir la caja')
        return
      }
      setMontoApertura('')
      cargarDatos()
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  const cerrarCaja = async () => {
    if (!cajaActual || !montoCierre || guardando) return
    setGuardando(true)
    try {
      const diferencia = Number(montoCierre) - efectivoEsperado
      const { error } = await supabaseApp.from('caja').update({
        estado: 'cerrada',
        monto_cierre: Number(montoCierre),
        diferencia,
        notas_cierre: notasCierre || null,
      }).eq('id', cajaActual.id).eq('estado', 'abierta')
      if (error) { alert('Error al cerrar la caja'); return }
      router.refresh()
      setMontoCierre('')
      setNotasCierre('')
      cargarDatos()
    } finally {
      setGuardando(false)
    }
  }

  const agregarGasto = async () => {
    if (!formGasto.descripcion || !formGasto.monto || !cajaActual) return
    setGuardando(true)
    await supabaseApp.from('gastos_caja').insert({
      local_id: localId,
      caja_id: cajaActual.id,
      descripcion: formGasto.descripcion.trim(),
      monto: Number(formGasto.monto),
    })
    setFormGasto({ descripcion: '', monto: '' })
    setGuardando(false)
    cargarDatos()
  }

  const totalVentas      = ventas.reduce((s, v) => s + Number(v.total), 0)
  const cantVentas       = ventas.length
  const totalEfectivo    = ventas.filter((v) => v.metodo_pago === 'efectivo').reduce((s, v) => s + Number(v.total), 0)
  const totalDigital     = totalVentas - totalEfectivo
  const totalGastos      = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const efectivoEsperado = cajaActual ? Number(cajaActual.monto_apertura) + totalEfectivo - totalGastos : 0

  const porOrigen = {
    comanda: ventas.filter((v) => v.origen === 'comanda').reduce((s, v) => s + Number(v.total), 0),
    delivery: ventas.filter((v) => v.origen === 'delivery').reduce((s, v) => s + Number(v.total), 0),
    qr: ventas.filter((v) => v.origen === 'qr').reduce((s, v) => s + Number(v.total), 0),
  }
  const porMetodo: Record<string, number> = {}
  for (const v of ventas) {
    porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] ?? 0) + Number(v.total)
  }
  const METODO_LABELS: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito' }

  return (
    <RouteGuard permiso="verCaja">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Caja</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Sin caja abierta */}
            {!cajaActual && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-1">Apertura de caja</h2>
                <p className="text-gray-400 text-sm mb-5">Ingresá el efectivo con el que iniciás el turno</p>
                <div className="flex gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    placeholder="Monto inicial ($)"
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={abrirCaja}
                    disabled={!montoApertura || guardando}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl px-5 py-3 text-sm transition"
                  >
                    {guardando ? 'Abriendo...' : 'Abrir caja'}
                  </button>
                </div>
              </div>
            )}

            {/* Caja abierta */}
            {cajaActual && (
              <>
                {/* Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Total ventas',       value: `$${totalVentas.toLocaleString()}`,      color: 'text-green-400' },
                    { label: 'Ventas efectivo',    value: `$${totalEfectivo.toLocaleString()}`,    color: 'text-green-300' },
                    { label: 'Ventas digital',     value: `$${totalDigital.toLocaleString()}`,     color: 'text-blue-400' },
                    { label: 'Cantidad ventas',    value: String(cantVentas),                      color: 'text-white' },
                    { label: 'Gastos',             value: `$${totalGastos.toLocaleString()}`,      color: 'text-red-400' },
                    { label: 'Efectivo esperado',  value: `$${efectivoEsperado.toLocaleString()}`, color: 'text-violet-400' },
                  ].map((m) => (
                    <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                      <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {([
                    { key: 'resumen', label: 'Cierre' },
                    { key: 'ventas',  label: 'Ventas' },
                    { key: 'gastos',  label: 'Gastos' },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition
                        ${tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {t.label}
                      {t.key === 'gastos' && gastos.length > 0 && (
                        <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{gastos.length}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Cierre */}
                {tab === 'resumen' && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                    <div className="space-y-2 text-sm text-gray-400 pb-4 border-b border-gray-800">
                      <div className="flex justify-between"><span>Apertura</span><span className="text-white">${Number(cajaActual.monto_apertura).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>+ Efectivo vendido</span><span className="text-green-400">+${totalEfectivo.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>- Gastos</span><span className="text-red-400">-${totalGastos.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-white pt-1"><span>Efectivo esperado</span><span className="text-violet-400">${efectivoEsperado.toLocaleString()}</span></div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Efectivo contado en caja ($)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={montoCierre}
                        onChange={(e) => setMontoCierre(e.target.value)}
                        placeholder="Contá el efectivo y escribí el total"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    {montoCierre && (
                      <div className={`rounded-xl p-3 text-sm font-medium ${
                        Number(montoCierre) - efectivoEsperado === 0 ? 'bg-green-950 text-green-400'
                        : Number(montoCierre) - efectivoEsperado > 0 ? 'bg-blue-950 text-blue-400'
                        : 'bg-red-950 text-red-400'
                      }`}>
                        Diferencia: ${(Number(montoCierre) - efectivoEsperado).toLocaleString()}
                        {Number(montoCierre) - efectivoEsperado === 0 && ' ✓ Caja cuadrada'}
                        {Number(montoCierre) - efectivoEsperado > 0 && ' (sobrante)'}
                        {Number(montoCierre) - efectivoEsperado < 0 && ' (faltante)'}
                      </div>
                    )}

                    <textarea
                      value={notasCierre}
                      onChange={(e) => setNotasCierre(e.target.value)}
                      placeholder="Notas del cierre (opcional)"
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                    />

                    <button
                      onClick={cerrarCaja}
                      disabled={!montoCierre || guardando}
                      className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                    >
                      {guardando ? 'Cerrando...' : 'Cerrar caja'}
                    </button>
                  </div>
                )}

                {/* Ventas */}
                {tab === 'ventas' && (
                  <div className="space-y-4">
                    {/* Por origen */}
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                      <h3 className="font-bold text-white text-sm">Por canal</h3>
                      {[
                        { label: 'Mesas / Comandas', value: porOrigen.comanda,  color: 'text-violet-400', icon: '🪑' },
                        { label: 'Delivery',          value: porOrigen.delivery, color: 'text-orange-400', icon: '🛵' },
                        { label: 'QR mesa',           value: porOrigen.qr,       color: 'text-green-400',  icon: '📱' },
                      ].filter((r) => r.value > 0).map((r) => (
                        <div key={r.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{r.icon}</span>
                            <span className="text-sm text-gray-300">{r.label}</span>
                          </div>
                          <span className={`text-sm font-bold ${r.color}`}>
                            ${r.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {totalVentas === 0 && <p className="text-gray-600 text-sm">Sin ventas registradas</p>}
                      <div className="border-t border-gray-800 pt-3 flex justify-between">
                        <span className="text-sm font-bold text-white">Total</span>
                        <span className="text-sm font-bold text-white">${totalVentas.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Por método de pago */}
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                      <h3 className="font-bold text-white text-sm">Por método de pago</h3>
                      {Object.entries(porMetodo).length === 0 && (
                        <p className="text-gray-600 text-sm">Sin ventas registradas</p>
                      )}
                      {Object.entries(porMetodo).map(([metodo, total]) => (
                        <div key={metodo} className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">{METODO_LABELS[metodo] ?? metodo}</span>
                          <span className="text-sm font-bold text-white">${total.toLocaleString()}</span>
                        </div>
                      ))}
                      {Object.keys(porMetodo).length > 1 && (
                        <div className="border-t border-gray-800 pt-3 flex justify-between">
                          <span className="text-sm font-bold text-white">Total</span>
                          <span className="text-sm font-bold text-white">${totalVentas.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Cant ventas */}
                    <p className="text-xs text-gray-600 text-center">{cantVentas} venta{cantVentas !== 1 ? 's' : ''} en este turno</p>
                  </div>
                )}

                {/* Gastos */}
                {tab === 'gastos' && (
                  <div className="space-y-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <h3 className="font-bold text-white mb-4">Registrar gasto</h3>
                      <div className="flex gap-3">
                        <input
                          value={formGasto.descripcion}
                          onChange={(e) => setFormGasto((f) => ({ ...f, descripcion: e.target.value }))}
                          placeholder="Descripción"
                          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formGasto.monto}
                          onChange={(e) => setFormGasto((f) => ({ ...f, monto: e.target.value }))}
                          placeholder="$"
                          className="w-24 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                        />
                        <button
                          onClick={agregarGasto}
                          disabled={!formGasto.descripcion || !formGasto.monto || guardando}
                          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl px-4 py-3 text-sm transition"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                      {gastos.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-10">Sin gastos registrados</p>
                      ) : (
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-800">
                            {gastos.map((g) => (
                              <tr key={g.id}>
                                <td className="px-5 py-3 text-sm text-white">{g.descripcion}</td>
                                <td className="px-5 py-3 text-sm font-semibold text-red-400 text-right">-${Number(g.monto).toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-800/50">
                              <td className="px-5 py-3 text-sm font-bold text-white">Total</td>
                              <td className="px-5 py-3 text-sm font-bold text-red-400 text-right">-${totalGastos.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </RouteGuard>
  )
}
