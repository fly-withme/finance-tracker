import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Erstellt den Supabase-Client für die Browser-Umgebung
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}