export type Plan = 'basico' | 'profesional' | 'premium' | 'sincargo'

export interface PlanLimits {
  productos: number | null   // null = ilimitado
  colaboradores: number
  usaMesas: boolean
  usaComandas: boolean
  usaCocina: boolean
  usaQrPedido: boolean
  usaDelivery: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basico: {
    productos: 50,
    colaboradores: 1,
    usaMesas: false,
    usaComandas: false,
    usaCocina: false,
    usaQrPedido: false,
    usaDelivery: true,
  },
  profesional: {
    productos: 150,
    colaboradores: 3,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
    usaDelivery: true,
  },
  premium: {
    productos: null,
    colaboradores: 6,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
    usaDelivery: true,
  },
  sincargo: {
    productos: null,
    colaboradores: 6,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
    usaDelivery: true,
  },
}

export function getLimites(plan: Plan | null): PlanLimits {
  return PLAN_LIMITS[plan ?? 'basico'] ?? PLAN_LIMITS.basico
}
