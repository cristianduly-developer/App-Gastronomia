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
