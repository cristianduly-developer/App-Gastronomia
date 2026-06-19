import 'server-only'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Si no hay credenciales de Upstash, usa fallback en memoria (dev local)
const hasUpstash =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// 5 pedidos de delivery por IP+local en 60 segundos
export const deliveryLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'rl:delivery',
    })
  : null

// 10 pedidos QR por IP+local+mesa en 60 segundos
export const qrLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:qr',
    })
  : null

// Fallback en memoria para dev (no usar en producción)
const memMap = new Map<string, number[]>()
export function checkMemRateLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const hits = (memMap.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= max) return false
  memMap.set(key, [...hits, now])
  return true
}
