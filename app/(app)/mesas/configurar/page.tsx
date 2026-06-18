'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

function linkMesa(localId: string, mesaId: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/menu/${localId}/mesa/${mesaId}`
}

interface Sector { id: string; nombre: string; orden: number }
interface Mesa { id: string; sector_id: string; nombre: string; capacidad: number }

export default function ConfigurarMesasPage() {
  const { localId } = useSession()
  const router = useRouter()
  const [sectores, setSectores] = useState<Sector[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)

  const [modalSector, setModalSector] = useState(false)
  const [editSector, setEditSector] = useState<Sector | null>(null)
  const [formSector, setFormSector] = useState('')

  const [modalMesa, setModalMesa] = useState(false)
  const [mesaSectorId, setMesaSectorId] = useState('')
  const [editMesa, setEditMesa] = useState<Mesa | null>(null)
  const [formMesa, setFormMesa] = useState({ nombre: '', capacidad: '2' })

  const [guardando, setGuardando] = useState(false)
  const [modalQR, setModalQR] = useState<{ nombre: string; url: string } | null>(null)

  const abrirQR = (mesa: Mesa) => {
    const url = linkMesa(localId!, mesa.id)
    setModalQR({ nombre: mesa.nombre, url })
  }

  const imprimirQR = () => {
    const ventana = window.open('', '_blank')
    if (!ventana || !modalQR) return
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(modalQR.url)}`
    ventana.document.write(`
      <html><head><title>QR ${modalQR.nombre}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Arial, sans-serif; background: #fff; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        p { color: #666; font-size: 14px; margin-bottom: 24px; }
        img { width: 300px; height: 300px; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h1>${modalQR.nombre}</h1>
        <p>Escaneá para ver el menú y pedir</p>
        <img src="${qrSrc}" />
        <br/><br/>
        <button onclick="window.print()" style="padding:12px 24px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:16px;cursor:pointer">Imprimir</button>
      </body></html>
    `)
    ventana.document.close()
  }

  useEffect(() => { if (localId) cargarDatos() }, [localId])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: s }, { data: m }] = await Promise.all([
      supabaseApp.from('sectores').select('*').eq('local_id', localId).eq('activo', true).order('orden'),
      supabaseApp.from('mesas').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
    ])
    setSectores(s ?? [])
    setMesas(m ?? [])
    setLoading(false)
  }

  const guardarSector = async () => {
    if (!formSector.trim()) return
    setGuardando(true)
    if (editSector) {
      await supabaseApp.from('sectores').update({ nombre: formSector.trim() }).eq('id', editSector.id)
    } else {
      await supabaseApp.from('sectores').insert({ local_id: localId, nombre: formSector.trim(), orden: sectores.length + 1 })
    }
    setModalSector(false)
    setFormSector('')
    setGuardando(false)
    cargarDatos()
  }

  const eliminarSector = async (id: string) => {
    if (!confirm('¿Eliminar este sector y todas sus mesas?')) return
    await supabaseApp.from('sectores').update({ activo: false }).eq('id', id)
    cargarDatos()
  }

  const abrirNuevaMesa = (sectorId: string) => {
    setMesaSectorId(sectorId)
    setEditMesa(null)
    setFormMesa({ nombre: '', capacidad: '2' })
    setModalMesa(true)
  }

  const abrirEditMesa = (m: Mesa) => {
    setMesaSectorId(m.sector_id)
    setEditMesa(m)
    setFormMesa({ nombre: m.nombre, capacidad: String(m.capacidad) })
    setModalMesa(true)
  }

  const guardarMesa = async () => {
    if (!formMesa.nombre.trim()) return
    setGuardando(true)
    const payload = { local_id: localId, sector_id: mesaSectorId, nombre: formMesa.nombre.trim(), capacidad: Number(formMesa.capacidad) || 2 }
    if (editMesa) {
      await supabaseApp.from('mesas').update(payload).eq('id', editMesa.id)
    } else {
      await supabaseApp.from('mesas').insert(payload)
    }
    setModalMesa(false)
    setGuardando(false)
    cargarDatos()
  }

  const eliminarMesa = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return
    await supabaseApp.from('mesas').update({ activo: false }).eq('id', id)
    cargarDatos()
  }

  return (
    <RouteGuard permiso="verConfig">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">← Volver</button>
          <h1 className="text-2xl font-bold text-white">Configurar mesas</h1>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditSector(null); setFormSector(''); setModalSector(true) }}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
          >
            + Nuevo sector
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sectores.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🪑</p>
            <p>Creá un sector para empezar (Salón, Terraza, Barra...)</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sectores.map((sector) => {
              const mesasSector = mesas.filter((m) => m.sector_id === sector.id)
              return (
                <div key={sector.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                    <h2 className="font-bold text-white">{sector.nombre}</h2>
                    <div className="flex gap-3">
                      <button onClick={() => { setEditSector(sector); setFormSector(sector.nombre); setModalSector(true) }} className="text-xs text-gray-400 hover:text-white transition">Editar</button>
                      <button onClick={() => eliminarSector(sector.id)} className="text-xs text-red-400 hover:text-red-300 transition">Eliminar</button>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {mesasSector.length === 0 && (
                      <p className="text-gray-600 text-sm">Sin mesas — agregá la primera</p>
                    )}
                    {mesasSector.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2.5">
                        <div>
                          <span className="text-sm font-medium text-white">{m.nombre}</span>
                          <span className="text-xs text-gray-500 ml-2">{m.capacidad} pers.</span>
                        </div>
                        <div className="flex gap-3 items-center">
                          <button
                            onClick={() => abrirQR(m)}
                            className="text-xs font-medium text-violet-400 hover:text-violet-300 transition"
                          >
                            📱 QR
                          </button>
                          <button onClick={() => abrirEditMesa(m)} className="text-xs text-gray-400 hover:text-white transition">Editar</button>
                          <button onClick={() => eliminarMesa(m.id)} className="text-xs text-red-400 hover:text-red-300 transition">Eliminar</button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => abrirNuevaMesa(sector.id)}
                      className="w-full mt-1 py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-sm transition"
                    >
                      + Agregar mesa
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal sector */}
      {modalSector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">{editSector ? 'Editar sector' : 'Nuevo sector'}</h3>
            <input
              value={formSector}
              onChange={(e) => setFormSector(e.target.value)}
              placeholder="Ej: Salón, Terraza, Barra..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModalSector(false)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">Cancelar</button>
              <button onClick={guardarSector} disabled={!formSector.trim() || guardando} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mesa */}
      {modalMesa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">{editMesa ? 'Editar mesa' : 'Nueva mesa'}</h3>
            <div className="space-y-3">
              <input
                value={formMesa.nombre}
                onChange={(e) => setFormMesa((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Mesa 1, Barra 2, VIP..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
              />
              <div>
                <label className="block text-xs text-gray-400 mb-1">Capacidad (personas)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={formMesa.capacidad}
                  onChange={(e) => setFormMesa((f) => ({ ...f, capacidad: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModalMesa(false)} className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition">Cancelar</button>
              <button onClick={guardarMesa} disabled={!formMesa.nombre.trim() || guardando} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {modalQR && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <h3 className="text-lg font-bold text-white mb-1">{modalQR.nombre}</h3>
            <p className="text-xs text-gray-400 mb-5">Escaneá para ver el menú y pedir</p>

            {/* QR generado via API pública */}
            <div className="bg-white rounded-2xl p-4 inline-block mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(modalQR.url)}`}
                alt={`QR ${modalQR.nombre}`}
                width={220}
                height={220}
              />
            </div>

            <p className="text-xs text-gray-600 break-all mb-5">{modalQR.url}</p>

            <div className="flex gap-3">
              <button
                onClick={() => setModalQR(null)}
                className="flex-1 bg-gray-800 text-gray-300 font-semibold rounded-xl py-3 text-sm hover:bg-gray-700 transition"
              >
                Cerrar
              </button>
              <button
                onClick={imprimirQR}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 text-sm transition"
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  )
}
