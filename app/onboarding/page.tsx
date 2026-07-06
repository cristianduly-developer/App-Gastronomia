'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

type TipoNegocio = 'food_truck' | 'rotiseria' | 'pizzeria' | 'restaurante' | 'cafeteria' | 'otro'

const TIPOS: { value: TipoNegocio; label: string; emoji: string }[] = [
  { value: 'food_truck', label: 'Food Truck', emoji: '🚚' },
  { value: 'rotiseria', label: 'Rotisería', emoji: '🍗' },
  { value: 'pizzeria', label: 'Pizzería', emoji: '🍕' },
  { value: 'restaurante', label: 'Restaurante', emoji: '🍽️' },
  { value: 'cafeteria', label: 'Cafetería', emoji: '☕' },
  { value: 'otro', label: 'Otro', emoji: '🏪' },
]

export default function OnboardingPage() {
  const { localId, plan, setSession } = useSession()
  const limites = getLimites(plan)
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    tipo: '' as TipoNegocio | '',
    telefono: '',
    usaMesas: false,
    usaDelivery: false,
    usaCocina: false,
    usaQr: false,
  })

  const handleToggle = (key: keyof typeof form) => {
    setForm((f) => ({ ...f, [key]: !f[key] }))
  }

  const handleFinalizar = async () => {
    if (!localId) return
    setLoading(true)

    await supabaseApp.from('config_local').upsert({
      local_id: localId,
      nombre_negocio: form.nombre,
      tipo_negocio: form.tipo,
      telefono: form.telefono,
      usa_mesas: form.usaMesas,
      usa_delivery: form.usaDelivery,
      usa_cocina: form.usaCocina,
      usa_qr: form.usaQr,
      onboarding_completo: true,
    })

    setSession({ nombreNegocio: form.nombre, onboardingCompleto: true })

    // Notificar al SaaS que este mail activó la demo
    const { data: { session } } = await supabaseApp.auth.getSession()
    const email = session?.user?.email
    if (email) {
      fetch('https://saas.solucionesmdp.com.ar/api/prospecto-activado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-id': 'app-gastronomia', 'x-app-key': process.env.NEXT_PUBLIC_ERROR_KEY || '' },
        body: JSON.stringify({ email }),
      }).catch(() => {})
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Banner de bienvenida */}
        <div className="rounded-2xl text-center p-6 mb-6" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 16px rgba(79,70,229,0.35)' }}>
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-white font-extrabold text-xl mb-1">¡Bienvenido/a!</div>
          <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Tu prueba gratuita de <strong>28 días</strong> del plan Profesional ya está activa.<br/>
            Configurá tu negocio en 3 pasos y empezá a gestionar tu gastronomía.
          </div>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${paso >= n ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {paso > n ? '✓' : n}
              </div>
              {n < 3 && <div className={`flex-1 h-0.5 ${paso > n ? 'bg-violet-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">

          {/* Paso 1 — Tu negocio */}
          {paso === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Tu negocio</h2>
                <p className="text-gray-400 text-sm mt-1">Contanos cómo se llama y qué tipo de lugar es</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre del negocio</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: La Esquina de Juan"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de negocio</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm((f) => ({ ...f, tipo: t.value }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all
                        ${form.tipo === t.value
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Teléfono (opcional)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="Ej: 2235001234"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <button
                onClick={() => setPaso(2)}
                disabled={!form.nombre || !form.tipo}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Paso 2 — ¿Cómo trabajás? */}
          {paso === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">¿Cómo trabajás?</h2>
                <p className="text-gray-400 text-sm mt-1">Activá las funciones que uses en tu negocio</p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'usaMesas',    planKey: 'usaMesas',    emoji: '🪑', label: 'Tenés mesas / comedor',      desc: 'Gestión visual de salón y comandas' },
                  { key: 'usaDelivery', planKey: 'usaDelivery', emoji: '🛵', label: 'Hacés delivery',              desc: 'Pedidos para envío a domicilio' },
                  { key: 'usaCocina',   planKey: 'usaCocina',   emoji: '👨‍🍳', label: 'Querés monitor de cocina',   desc: 'Pantalla en cocina con pedidos en tiempo real' },
                  { key: 'usaQr',       planKey: 'usaQrPedido', emoji: '📱', label: 'Querés menú QR',              desc: 'Los clientes ven la carta desde su celu' },
                ].map(({ key, planKey, emoji, label, desc }) => {
                  const disponible = limites[planKey as keyof typeof limites] as boolean
                  const activo = !!form[key as keyof typeof form]
                  return (
                    <button
                      key={key}
                      onClick={() => disponible && handleToggle(key as keyof typeof form)}
                      disabled={!disponible}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all
                        ${!disponible
                          ? 'bg-gray-900 border-gray-800 opacity-60 cursor-not-allowed'
                          : activo
                            ? 'bg-violet-950 border-violet-600'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{label}</p>
                          {!disponible && (
                            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-lg font-medium">
                              Plan Profesional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      {disponible && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                          ${activo ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
                          {activo && <span className="text-white text-xs">✓</span>}
                        </div>
                      )}
                      {!disponible && <span className="text-gray-600 text-lg">🔒</span>}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPaso(1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition">
                  Atrás
                </button>
                <button onClick={() => setPaso(3)} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 transition">
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Paso 3 — Resumen */}
          {paso === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">¡Todo listo!</h2>
                <p className="text-gray-400 text-sm mt-1">Así quedó configurado tu negocio</p>
              </div>

              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TIPOS.find((t) => t.value === form.tipo)?.emoji ?? '🏪'}</span>
                  <div>
                    <p className="text-white font-semibold">{form.nombre}</p>
                    <p className="text-gray-400 text-xs">{TIPOS.find((t) => t.value === form.tipo)?.label}</p>
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-3 grid grid-cols-2 gap-2">
                  {[
                    { active: form.usaMesas, label: 'Mesas', emoji: '🪑' },
                    { active: form.usaDelivery, label: 'Delivery', emoji: '🛵' },
                    { active: form.usaCocina, label: 'Cocina', emoji: '👨‍🍳' },
                    { active: form.usaQr, label: 'Menú QR', emoji: '📱' },
                  ].map(({ active, label, emoji }) => (
                    <div key={label} className={`flex items-center gap-2 text-sm ${active ? 'text-green-400' : 'text-gray-600'}`}>
                      <span>{emoji}</span>
                      <span>{label}</span>
                      <span>{active ? '✓' : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-gray-500 text-xs text-center">
                Podés cambiar estas opciones en cualquier momento desde Configuración
              </p>

              <div className="flex gap-3">
                <button onClick={() => setPaso(2)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl py-3 transition">
                  Atrás
                </button>
                <button
                  onClick={handleFinalizar}
                  disabled={loading}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition"
                >
                  {loading ? 'Guardando...' : 'Empezar a usar'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
