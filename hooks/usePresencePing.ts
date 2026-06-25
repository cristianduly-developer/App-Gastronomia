"use client";
import { useEffect } from "react";
import { supabaseApp as supabase } from "@/lib/supabaseApp";

const INTERVALO_MS = 5 * 60 * 1000

export function usePresencePing() {
  useEffect(() => {
    const ping = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return
      await fetch(`/api/verificar-acceso?email=${encodeURIComponent(session.user.email)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    }

    ping()
    const intervalo = setInterval(ping, INTERVALO_MS)
    return () => clearInterval(intervalo)
  }, [])
}
