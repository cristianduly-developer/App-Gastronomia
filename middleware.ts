import { NextRequest, NextResponse } from 'next/server'

// Solo proteger rutas bajo /(app)/* — el resto maneja su propio auth en cliente
// Las rutas de Next.js bajo el grupo (app) se mapean sin el paréntesis en la URL
const APP_ROUTES = [
  '/dashboard', '/mesas', '/ventas', '/cocina', '/delivery',
  '/pedidos', '/productos', '/categorias', '/clientes',
  '/colaboradores', '/configuracion', '/reportes', '/caja', '/sectores',
]

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function applySecurityHeaders(res: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Aplicar headers de seguridad a todas las respuestas
  const response = NextResponse.next()
  applySecurityHeaders(response)

  // Solo verificar sesión en rutas protegidas de la app
  const isAppRoute = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  if (!isAppRoute) return response

  // Verificar cookie de sesión de Supabase
  const sessionCookie = request.cookies.get('sb-access-token')?.value
    ?? request.cookies.getAll().find(c => c.name.includes('auth-token'))?.value

  if (!sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
