import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

// Returns null if service role key is not configured
// This prevents the app from crashing when the key isn't set
export const getAdminClient = () => {
  if (!serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
