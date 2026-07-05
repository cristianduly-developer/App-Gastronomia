export type RolSistema = 'owner' | 'cajero' | 'mozo' | 'cocina'

export interface Permisos {
  verDashboard: boolean
  verVentas: boolean
  crearVentas: boolean
  verMesas: boolean
  verComandas: boolean
  crearComandas: boolean
  verCocina: boolean
  verDelivery: boolean
  verClientes: boolean
  verCaja: boolean
  verProductos: boolean
  verConfig: boolean
  verColaboradores: boolean
  verReportes: boolean
}

const PERMISOS_POR_ROL: Record<RolSistema, Permisos> = {
  owner: {
    verDashboard: true,
    verVentas: true,
    crearVentas: true,
    verMesas: true,
    verComandas: true,
    crearComandas: true,
    verCocina: true,
    verDelivery: true,
    verClientes: true,
    verCaja: true,
    verProductos: true,
    verConfig: true,
    verColaboradores: true,
    verReportes: true,
  },
  cajero: {
    verDashboard: true,
    verVentas: true,
    crearVentas: true,
    verMesas: false,
    verComandas: true,
    crearComandas: false,
    verCocina: false,
    verDelivery: true,
    verClientes: true,
    verCaja: true,
    verProductos: false,
    verConfig: false,
    verColaboradores: false,
    verReportes: false,
  },
  mozo: {
    verDashboard: false,
    verVentas: false,
    crearVentas: false,
    verMesas: true,
    verComandas: true,
    crearComandas: true,
    verCocina: false,
    verDelivery: false,
    verClientes: false,
    verCaja: false,
    verProductos: false,
    verConfig: false,
    verColaboradores: false,
    verReportes: false,
  },
  cocina: {
    verDashboard: false,
    verVentas: false,
    crearVentas: false,
    verMesas: false,
    verComandas: false,
    crearComandas: false,
    verCocina: true,
    verDelivery: false,
    verClientes: false,
    verCaja: false,
    verProductos: false,
    verConfig: false,
    verColaboradores: false,
    verReportes: false,
  },
}

export function getPermisos(rol: RolSistema): Permisos {
  return PERMISOS_POR_ROL[rol]
}
