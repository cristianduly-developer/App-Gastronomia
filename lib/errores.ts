// Traduce un error de Supabase a un mensaje claro para el usuario.
// Devuelve null si no es un caso especial (el caller usa su mensaje genérico).
// - 42501 / "row-level security": lo frenó una policy → suscripción vencida o feature no incluida.
export function mensajeErrorGuardado(
  error: { message?: string | null; code?: string | null } | null | undefined
): string | null {
  const msg = (error?.message || '').toLowerCase()
  const esRLS =
    error?.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('row level security')
  if (esRLS) {
    if (msg.includes('feat_'))
      return '🔒 Esta función no está incluida en tu plan actual. Actualizá el plan para usarla.'
    return '🔒 Tu suscripción venció o está suspendida. Renovala para seguir usando la app. Tus datos siguen guardados y podés verlos.'
  }
  return null
}
