'use client'
import { useSession } from '@/lib/sessionStore'
import { usePlan } from '@/hooks/usePlan'
import type { PlanLimits } from '@/lib/planLimits'

const FEATURE_LABELS: Partial<Record<keyof PlanLimits, string>> = {
  usaMesas:    'Gestión de mesas y salón',
  usaComandas: 'Comandas',
  usaCocina:   'Monitor de cocina',
  usaQrPedido: 'Pedidos desde QR',
  usaDelivery: 'Delivery',
}

const UPGRADE_PLAN: Partial<Record<keyof PlanLimits, string>> = {
  usaMesas:    'Profesional',
  usaComandas: 'Profesional',
  usaCocina:   'Profesional',
  usaQrPedido: 'Profesional',
  usaDelivery: 'Básico',
}

interface Props {
  feature: keyof PlanLimits
  children: React.ReactNode
}

export function PlanGuard({ feature, children }: Props) {
  const { plan } = useSession()
  const limites = usePlan()
  const tieneAcceso = limites[feature] as boolean

  if (tieneAcceso) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
      <div className="text-5xl mb-5">🔒</div>
      <h2 className="text-xl font-bold text-white mb-2">
        {FEATURE_LABELS[feature] ?? 'Esta función'} no está disponible en tu plan
      </h2>
      <p className="text-gray-400 text-sm mb-1">
        Estás en el plan <span className="text-white font-semibold capitalize">{plan ?? 'Básico'}</span>.
      </p>
      <p className="text-gray-500 text-sm mb-8">
        Disponible desde el plan <span className="text-violet-400 font-semibold">{UPGRADE_PLAN[feature]}</span>.
      </p>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 max-w-xs text-left space-y-2">
        <p className="text-xs font-semibold text-gray-400 mb-3">Para subir de plan:</p>
        <p className="text-sm text-gray-300">Contactá a tu administrador o escribinos para cambiar tu suscripción.</p>
      </div>
    </div>
  )
}
