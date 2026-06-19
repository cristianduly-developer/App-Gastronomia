'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RouteGuard } from '@/components/RouteGuard'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

interface Config {
  nombre_negocio: string
  tipo_negocio: string
  telefono: string
  usa_mesas: boolean
  usa_delivery: boolean
  usa_cocina: boolean
  usa_qr: boolean
  usa_qr_pedidos: boolean
  logo_url: string
}

const TIPO_LABELS: Record<string, string> = {
  food_truck: 'Food Truck',
  rotiseria:  'Rotisería',
  pizzeria:   'Pizzería',
  restaurante:'Restaurante',
  cafeteria:  'Cafetería',
  otro:       'Otro',
}

export default function ConfiguracionPage() {
  const { localId, setSession } = useSession()
  const router = useRouter()
  const [config, setConfig] = useState<Config | null>(null)
  const [form, setForm] = useState<Config | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const menuUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/menu/${localId}`
    : ''

  useEffect(() => {
    if (!localId) return
    supabaseApp
      .from('config_local')
      .select('*')
      .eq('local_id', localId)
      .single()
      .then(({ data }) => {
        if (data) {
          const c: Config = {
            nombre_negocio:  data.nombre_negocio ?? '',
            tipo_negocio:    data.tipo_negocio ?? '',
            telefono:        data.telefono ?? '',
            usa_mesas:       data.usa_mesas ?? false,
            usa_delivery:    data.usa_delivery ?? false,
            usa_cocina:      data.usa_cocina ?? false,
            usa_qr:          data.usa_qr ?? false,
            usa_qr_pedidos:  data.usa_qr_pedidos ?? false,
            logo_url:        data.logo_url ?? '',
          }
          setConfig(c)
          setForm(c)
        }
      })
  }, [localId])

  const guardar = async () => {
    if (!form || !localId) return
    setGuardando(true)
    await supabaseApp.from('config_local').update({
      nombre_negocio: form.nombre_negocio,
      tipo_negocio:   form.tipo_negocio,
      telefono:       form.telefono,
      usa_mesas:      form.usa_mesas,
      usa_delivery:   form.usa_delivery,
      usa_cocina:      form.usa_cocina,
      usa_qr:          form.usa_qr,
      usa_qr_pedidos:  form.usa_qr_pedidos,
      logo_url:        form.logo_url,
    }).eq('local_id', localId)
    setConfig(form)
    setSession({
      nombreNegocio: form.nombre_negocio,
      usaMesas: form.usa_mesas,
      usaDelivery: form.usa_delivery,
      usaCocina: form.usa_cocina,
      usaQr: form.usa_qr,
    })
    setGuardando(false)
    router.push('/dashboard')
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(menuUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !localId) return
    if (file.size > 2 * 1024 * 1024) { alert('El logo no puede superar 2 MB'); return }
    const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!TIPOS_PERMITIDOS.includes(file.type)) { alert('Solo se permiten imágenes JPG, PNG, WebP o GIF'); return }

    setSubiendoLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${localId}/logo.${ext}`

    const { error } = await supabaseApp.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir el logo'); setSubiendoLogo(false); return }

    const { data: { publicUrl } } = supabaseApp.storage.from('logos').getPublicUrl(path)
    const urlConBust = `${publicUrl}?v=${Date.now()}`

    await supabaseApp.from('config_local').update({ logo_url: urlConBust }).eq('local_id', localId)
    setForm((f) => f ? { ...f, logo_url: urlConBust } : f)
    setConfig((c) => c ? { ...c, logo_url: urlConBust } : c)
    setSubiendoLogo(false)
  }

  const borrarLogo = async () => {
    if (!localId || !form?.logo_url) return
    const path = form.logo_url.split('/logos/')[1]?.split('?')[0]
    if (path) await supabaseApp.storage.from('logos').remove([path])
    await supabaseApp.from('config_local').update({ logo_url: null }).eq('local_id', localId)
    setForm((f) => f ? { ...f, logo_url: '' } : f)
    setConfig((c) => c ? { ...c, logo_url: '' } : c)
  }

  const toggle = (key: keyof Config) => {
    setForm((f) => f ? { ...f, [key]: !f[key] } : f)
  }

  if (!form) {
    return (
      <RouteGuard permiso="verConfig">
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </RouteGuard>
    )
  }

  const hayCambios = JSON.stringify(form) !== JSON.stringify(config)

  return (
    <RouteGuard permiso="verConfig">
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-white">Configuración</h1>

        {/* Datos del negocio */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-white">Datos del negocio</h2>

          {/* Logo */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Logo del negocio</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border border-gray-700 bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.logo_url
                  ? <img src={form.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                  : <span className="text-3xl">🍽️</span>}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={subirLogo}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={subiendoLogo}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition"
                >
                  {subiendoLogo ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {form.logo_url && (
                  <button
                    onClick={borrarLogo}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-xs font-semibold rounded-xl transition"
                  >
                    Quitar logo
                  </button>
                )}
                <p className="text-xs text-gray-600">PNG, JPG o SVG · máx 2 MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nombre del negocio</label>
            <input
              value={form.nombre_negocio}
              onChange={(e) => setForm((f) => f ? { ...f, nombre_negocio: e.target.value } : f)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tipo de negocio</label>
            <select
              value={form.tipo_negocio}
              onChange={(e) => setForm((f) => f ? { ...f, tipo_negocio: e.target.value } : f)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
            >
              {Object.entries(TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm((f) => f ? { ...f, telefono: e.target.value } : f)}
              placeholder="Ej: 2235001234"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </section>

        {/* Funciones activas */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-white mb-1">Funciones activas</h2>
          {([
            { key: 'usa_mesas',    emoji: '🪑', label: 'Mesas / comedor',   desc: 'Gestión visual de salón y comandas' },
            { key: 'usa_delivery', emoji: '🛵', label: 'Delivery',           desc: 'Pedidos para envío a domicilio' },
            { key: 'usa_cocina',   emoji: '👨‍🍳', label: 'Monitor de cocina', desc: 'Pantalla en cocina con pedidos en tiempo real' },
            { key: 'usa_qr',         emoji: '📱', label: 'Menú QR',                desc: 'Los clientes ven la carta desde su celu' },
            { key: 'usa_qr_pedidos', emoji: '🛒', label: 'Pedidos desde el QR',    desc: 'Los clientes pueden pedir desde la carta, el mozo confirma' },
          ] as const).map(({ key, emoji, label, desc }) => (
            <button
              key={key}
              onClick={() => toggle(key as keyof Config)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all
                ${form[key as keyof Config]
                  ? 'bg-violet-950 border-violet-600'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
            >
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                ${form[key as keyof Config] ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
                {form[key as keyof Config] && <span className="text-white text-xs">✓</span>}
              </div>
            </button>
          ))}
        </section>

        {/* Link delivery */}
        {form.usa_delivery && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-white">Link de delivery</h2>
            <p className="text-xs text-gray-400">
              Compartí este link o generá un QR para que tus clientes hagan pedidos a domicilio.
            </p>
            {(() => {
              const deliveryUrl = typeof window !== 'undefined' ? `${window.location.origin}/delivery/${localId}` : ''
              return (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={deliveryUrl}
                      className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl px-4 py-3 text-xs focus:outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(deliveryUrl) }}
                      className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition flex-shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(deliveryUrl)}`}
                      alt="QR delivery"
                      className="w-24 h-24 rounded-xl bg-white p-1"
                    />
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Imprimí este QR y pegalo en la puerta, el menú físico o compartilo por WhatsApp.</p>
                      <a href={deliveryUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition inline-block">
                        Ver link ↗
                      </a>
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>
        )}

        {/* Link menú QR */}
        {form.usa_qr && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white">Menú QR</h2>

            <div>
              <p className="text-xs text-gray-400 mb-2">
                Link de la carta — compartilo o generá un QR para que tus clientes la vean desde el celu.
              </p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  readOnly
                  value={menuUrl}
                  className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl px-4 py-3 text-xs focus:outline-none"
                  onClick={() => inputRef.current?.select()}
                />
                <button
                  onClick={copiarLink}
                  className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition flex-shrink-0"
                >
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition mt-2">
                Ver carta ↗
              </a>
            </div>

            {form.usa_qr_pedidos && (
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-400 mb-1">
                  Los QR por mesa incluyen la mesa en el link. Generalos desde{' '}
                  <a href="/mesas/configurar" className="text-violet-400 hover:text-violet-300 transition">Configurar mesas ↗</a>
                </p>
                <p className="text-xs text-gray-500">
                  Formato: <code className="text-gray-400">/menu/{'{localId}'}/mesa/{'{mesaId}'}</code>
                </p>
              </div>
            )}
          </section>
        )}

        {/* Guardar */}
        <button
          onClick={guardar}
          disabled={!hayCambios || guardando}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition"
        >
          {guardando ? 'Guardando...' : guardado ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </RouteGuard>
  )
}
