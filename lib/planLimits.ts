export type Plan = 'basico' | 'profesional' | 'premium' | 'sincargo'

export interface PlanLimits {
  productos: number | null
  colaboradores: number
  usaMesas: boolean
  usaComandas: boolean
  usaCocina: boolean
  usaQrPedido: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basico: {
    productos: 50,
    colaboradores: 1,
    usaMesas: false,
    usaComandas: false,
    usaCocina: false,
    usaQrPedido: false,
  },
  profesional: {
    productos: 150,
    colaboradores: 3,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
  },
  premium: {
    productos: null, // ilimitados
    colaboradores: 6,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
  },
  sincargo: {
    productos: null,
    colaboradores: 6,
    usaMesas: true,
    usaComandas: true,
    usaCocina: true,
    usaQrPedido: true,
  },
}

export function getLimites(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.basico
}
