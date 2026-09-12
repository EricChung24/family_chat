import type { Profile } from './types'

export const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export function getFamilyScope(profile: Profile | null) {
  if (!profile?.family_id) throw new Error('A family membership is required before loading shared content.')
  return profile.family_id
}

export function previewModeLabel() { return isSupabaseConfigured ? 'Connected to Supabase' : 'Preview mode — connect Supabase to persist changes' }
