import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RolSistema, type Permisos, getPermisos } from './permisos'
import { type Plan } from './planLimits'

export type EstadoSuscripcion = 'activo' | 'demo' | 'impago' | 'suspendido'

interface SessionData {
  localId: string | null
  plan: Plan | null
  nombreNegocio: string | null
  rol: 'owner' | 'colaborador' | null
  rolSistema: RolSistema | null
  permisos: Permisos | null
  estadoSuscripcion: EstadoSuscripcion | null
  diasRestantes: number | null
  onboardingCompleto: boolean
  mesasAsignadas: string[] | null  // null = todas, array = solo esas
  _hydrated: boolean
}

interface SessionActions {
  setSession: (data: Partial<SessionData>) => void
  clearSession: () => void
  setHydrated: () => void
}

const initialState: SessionData = {
  localId: null,
  plan: null,
  nombreNegocio: null,
  rol: null,
  rolSistema: null,
  permisos: null,
  estadoSuscripcion: null,
  diasRestantes: null,
  onboardingCompleto: false,
  mesasAsignadas: null,
  _hydrated: false,
}

export const useSession = create<SessionData & SessionActions>()(
  persist(
    (set) => ({
      ...initialState,
      setSession: (data) =>
        set((state) => {
          const rolSistema = data.rolSistema ?? state.rolSistema
          return {
            ...state,
            ...data,
            permisos: rolSistema ? getPermisos(rolSistema) : state.permisos,
          }
        }),
      clearSession: () => set({ ...initialState, _hydrated: true }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'gastro-session',
      partialize: (state) => ({
        localId: state.localId,
        plan: state.plan,
        nombreNegocio: state.nombreNegocio,
        rol: state.rol,
        rolSistema: state.rolSistema,
        estadoSuscripcion: state.estadoSuscripcion,
        diasRestantes: state.diasRestantes,
        onboardingCompleto: state.onboardingCompleto,
        mesasAsignadas: state.mesasAsignadas,
      }),
    }
  )
)
