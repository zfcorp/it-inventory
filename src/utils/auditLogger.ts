import { supabase } from '../lib/supabase'

interface LogParams {
  userProfile: { id: string; full_name?: string | null; email?: string } | null
  action: string
  assetId?: string | null
  previousValue?: string | null
  newValue?: string | null
  details?: string | null
}

export const logAudit = async ({
  userProfile,
  action,
  assetId = null,
  previousValue = null,
  newValue = null,
  details = null,
}: LogParams) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userProfile?.id || null,
      user_name: userProfile?.full_name || userProfile?.email || 'System',
      action,
      asset_id: assetId,
      previous_value: previousValue,
      new_value: newValue,
      details,
    })
  } catch (err) {
    // Audit logging failure should never block the main operation
    console.error('Audit log error:', err)
  }
}
