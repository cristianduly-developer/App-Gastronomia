'use client'
import { useEffect, useState } from 'react'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Caja {
  id: string
  estado: 'abierta' | 'cerrada'
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

export default function CajaPage() {
  const { localId } = useSession()
  const [cajaActual, setCajaActual] = useState<Caja | null>(null)
  const [gastos, setGastos] = useState<GastoCaja[]>([])
  const [ventasHoy, setVentasHoy] = useState<{ total: number; cantidad: number; efectivo: number }>({ total: 0, cantidad: 0, efectivo: 0 })
  const [loading, setLoading] = useState(true)

  // Forms
  const [montoApertura, setMontoApertura] = useState('')
  const [montoCierre, setMontoCierre] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [formGasto, setFormGasto] = useState({ descripcion: '', monto: '' })
  const [guardando, setGuardando] = useState(false)
  const [tab, setTab] = useState<'resumen' | 'gastos'>('resumen')

  useEffect(() => {
    if (!localId) return
    cargarDatos()
  }, [localId])

  const cargarDatos = async () => {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]

    const [{ data: cajaData }, { data: gastosData }, { data: ventasData }] = await Promise.all([
      supabaseApp.from('caja').select('*').eq('local_id', localId).eq('estado', 'abierta').maybeSingle(),
      supabaseApp.from('gastos_caja').select('*').eq('local_id', localId).order('created_at', { ascending: false }),
      supabaseApp.from('ventas').select('total, metodo_pago').eq('local_id', localId).eq('estado', 'completada').gte('created_at', hoy),
    ])

    setCajaActual(cajaData ?? null)
    setGastos(gastosData ?? [])

    const ventas = ventasData ?? []
    setVentasHoy({
      total: ventas.reduce((acc, v) => acc + (v.total ?? 0), 0),
      cantidad: ventas.length,
      efectivo: ventas.filter((v) => v.metodo_pago === 'efectivo').reduce((acc, v) => acc + (v.total ?? 0), 0),
    })

    setLoading(false)
  }

  const abrirCaja = async () => {
    if (!montoApertura) return
    setGuardando(true)
    await supabaseApp.from('caja').insert({
      local_id: localId,
      estado: 'abierta',
      monto_apertura: Number(montoApertura),
    })
    setMontoApertura('')
    setGuardando(false)
    cargarDatos()
  }

  const cerrarCaja = async () => {
    if (!cajaActual || !montoCierre) return
    setGuardando(true)
    const efectivoEsperado = (cajaActual.monto_apertura ?? 0) + ventasHoy.efectivo - gastos.reduce((acc, g) => acc + g.monto, 0)
    const diferencia = Number(montoCierre) - efectivoEsperado

    await supabaseApp.from('caja').update({
      estado: 'cerrada',
      monto_cierre: Number(montoCierre),
      diferencia,
      notas_cierre: notasCierre || null,
    }).eq('id', cajaActual.id)

    setMontoCierre('')
    setNotasCierre('')
    setGuardando(false)
    cargarDatos()
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

  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0)
  const efectivoEsperado = cajaActual
    ? (cajaActual.monto_apertura ?? 0) + ventasHoy.efectivo - totalGastos
    : 0

  return (
    <RouteGuard permiso="verCaja">
      <div className="max-w-2xl mx-auto">
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
                    Abrir caja
                  </button>
                </div>
              </div>
            )}

            {/* Caja abierta */}
            {cajaActual && (
              <>
                {/* Estado actual */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Ventas hoy', value: `$${ventasHoy.total.toLocaleString()}`, color: 'text-green-400' },
                    { label: 'Pedidos', value: ventasHoy.cantidad, color: 'text-white' },
                    { label: 'Gastos', value: `$${totalGastos.toLocaleString()}`, color: 'text-red-400' },
                    { label: 'Efectivo esperado', value: `$${efectivoEsperado.toLocaleString()}`, color: 'text-violet-400' },
                  ].map((m) => (
                    <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                      <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {(['resumen', 'gastos'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition
                        ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Tab resumen — cierre de caja */}
                {tab === 'resumen' && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                    <h2 className="font-bold text-white">Cierre de caja</h2>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Efectivo contado en caja ($)
                      </label>
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
                        Number(montoCierre) - efectivoEsperado === 0
                          ? 'bg-green-950 text-green-400'
                          : Number(montoCierre) - efectivoEsperado > 0
                            ? 'bg-blue-950 text-blue-400'
                            : 'bg-red-950 text-red-400'
                      }`}>
                        Diferencia: ${(Number(montoCierre) - efectivoEsperado).toLocaleString()}
                        {Number(montoCierre) - efectivoEsperado === 0 && ' ✓ Caja cuadrada'}
                        {Number(montoCierre) - efectivoEsperado > 0 && ' (sobrante)'}
                        {Number(montoCierre) - efectivoEsperado < 0 && ' (faltante)'}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas (opcional)</label>
                      <textarea
                        value={notasCierre}
                        onChange={(e) => setNotasCierre(e.target.value)}
                        placeholder="Observaciones del cierre..."
                        rows={2}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                      />
                    </div>

                    <button
                      onClick={cerrarCaja}
                      disabled={!montoCierre || guardando}
                      className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition"
                    >
                      {guardando ? 'Cerrando...' : 'Cerrar caja'}
                    </button>
                  </div>
                )}

                {/* Tab gastos */}
                {tab === 'gastos' && (
                  <div className="space-y-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <h3 className="font-bold text-white mb-4">Registrar gasto</h3>
                      <div className="flex gap-3">
                        <input
                          value={formGasto.descripcion}
                          onChange={(e) => setFormGasto((f) => ({ ...f, descripcion: e.target.value }))}
                          placeholder="Descripción del gasto"
                          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formGasto.monto}
                          onChange={(e) => setFormGasto((f) => ({ ...f, monto: e.target.value }))}
                          placeholder="Monto"
                          className="w-28 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
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
                        <p className="text-gray-500 text-sm text-center py-10">No hay gastos registrados</p>
                      ) : (
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-800">
                            {gastos.map((g) => (
                              <tr key={g.id}>
                                <td className="px-5 py-3 text-sm text-white">{g.descripcion}</td>
                                <td className="px-5 py-3 text-sm font-semibold text-red-400 text-right">
                                  -${g.monto.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-800/50">
                              <td className="px-5 py-3 text-sm font-bold text-white">Total gastos</td>
                              <td className="px-5 py-3 text-sm font-bold text-red-400 text-right">
                                -${totalGastos.toLocaleString()}
                              </td>
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
