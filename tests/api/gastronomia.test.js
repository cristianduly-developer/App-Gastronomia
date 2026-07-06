const { test, expect } = require('@playwright/test')

const BASE = 'https://gastronomia.solucionesmdp.com.ar'
const SAAS = 'https://saas.solucionesmdp.com.ar'
const TOKEN = process.env.GASTRO_TOKEN || ''
const EMAIL = process.env.GASTRO_EMAIL || 'cristianduly@gmail.com'
const AUTH = { Authorization: `Bearer ${TOKEN}` }

// ─── VERIFICAR ACCESO ───────────────────────────────────────────────
test.describe('verificar-acceso', () => {
  test('sin token retorna error 4xx', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('con token inválido retorna error 4xx', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso?email=${EMAIL}`, {
      headers: { Authorization: 'Bearer token_falso_123' }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('con token válido retorna acceso y plan', async ({ request }) => {
    if (!TOKEN) return test.skip()
    const res = await request.get(`${BASE}/api/verificar-acceso?email=${EMAIL}`, { headers: AUTH })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // Gastronomia retorna { esColab, acceso: { tiene_acceso, plan, ... } }
    expect(body.acceso.tiene_acceso).toBe(true)
    expect(['sincargo','demo','basico','profesional','premium']).toContain(body.acceso.plan)
  })

  test('login=true registra sesión', async ({ request }) => {
    if (!TOKEN) return test.skip()
    const res = await request.get(`${BASE}/api/verificar-acceso?email=${EMAIL}&login=true`, { headers: AUTH })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.acceso.tiene_acceso).toBe(true)
  })
})

// ─── PLANES Y PRECIOS ───────────────────────────────────────────────
test.describe('planes-precios', () => {
  test('retorna lista de planes', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.planes)).toBe(true)
    expect(body.planes.length).toBeGreaterThan(0)
  })

  test('cada plan tiene nombre y precio', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    for (const plan of body.planes) {
      expect(plan).toHaveProperty('plan')
      expect(plan).toHaveProperty('precio_mensual')
      expect(['sincargo','demo','basico','profesional','premium']).toContain(plan.plan)
    }
  })

  test('existe plan básico con precio 25000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const basico = body.planes.find(p => p.plan === 'basico')
    expect(basico).toBeTruthy()
    expect(basico.precio_mensual).toBe(25000)
  })

  test('existe plan profesional con precio 35000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const prof = body.planes.find(p => p.plan === 'profesional')
    expect(prof).toBeTruthy()
    expect(prof.precio_mensual).toBe(35000)
  })

  test('existe plan premium con precio 50000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const prem = body.planes.find(p => p.plan === 'premium')
    expect(prem).toBeTruthy()
    expect(prem.precio_mensual).toBe(50000)
  })
})

// ─── COLABORADORES ──────────────────────────────────────────────────
test.describe('colaboradores', () => {
  test('sin auth retorna error 4xx', async ({ request }) => {
    const res = await request.get(`${BASE}/api/colaboradores`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('con auth retorna lista', async ({ request }) => {
    if (!TOKEN) return test.skip()
    const res = await request.get(`${BASE}/api/colaboradores`, { headers: AUTH })
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── ENDPOINTS PÚBLICOS ─────────────────────────────────────────────
test.describe('endpoints públicos', () => {
  test('qr-pedido sin datos retorna error controlado', async ({ request }) => {
    const res = await request.get(`${BASE}/api/public/qr-pedido`)
    expect(res.status()).toBeLessThan(500)
  })

  test('delivery-pedido sin datos retorna error controlado', async ({ request }) => {
    const res = await request.post(`${BASE}/api/public/delivery-pedido`, { data: {} })
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── MP SUSCRIPCION ─────────────────────────────────────────────────
test.describe('mp-crear-suscripcion', () => {
  test('sin auth retorna error 4xx', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mp-crear-suscripcion`, {
      data: { plan: 'profesional' }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('con auth y plan inválido no explota', async ({ request }) => {
    if (!TOKEN) return test.skip()
    const res = await request.post(`${BASE}/api/mp-crear-suscripcion`, {
      headers: AUTH,
      data: { plan: 'plan_inexistente' }
    })
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── MP CANCELAR ────────────────────────────────────────────────────
test.describe('mp-cancelar-suscripcion', () => {
  test('sin auth retorna error 4xx', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mp-cancelar-suscripcion`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── REGISTRAR DEMO ─────────────────────────────────────────────────
test.describe('registrar-demo', () => {
  test('sin token retorna error 4xx', async ({ request }) => {
    const res = await request.post(`${BASE}/api/registrar-demo`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('con token retorna respuesta controlada', async ({ request }) => {
    if (!TOKEN) return test.skip()
    const res = await request.post(`${BASE}/api/registrar-demo`, { headers: AUTH })
    expect(res.status()).toBeLessThan(500)
    const body = await res.json()
    expect(typeof body.ok).toBe('boolean')
  })
})

// ─── SET ACCESS ─────────────────────────────────────────────────────
test.describe('set-access', () => {
  test('sin x-app-key retorna error controlado', async ({ request }) => {
    const res = await request.post(`${BASE}/api/set-access`, {
      data: { plan: 'basico' }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── REPORTAR ERROR (SaaS) ──────────────────────────────────────────
test.describe('reportar-error (SaaS)', () => {
  test('acepta errores de app gastronomia sin explotar', async ({ request }) => {
    const res = await request.post(`${SAAS}/api/reportar-error`, {
      headers: { 'x-app-id': 'gastronomia', 'x-app-key': 'clave_invalida' },
      data: { mensaje: 'Test E2E gastronomia', nivel: 'info' }
    })
    expect(res.status()).toBeLessThan(500)
  })
})
