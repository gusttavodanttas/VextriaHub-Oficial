import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OverrideRequest {
  user_id: string;
  action: 'block' | 'unblock' | 'activate' | 'suspend';
  reason: string;
  access_status?: 'active' | 'blocked' | 'suspended';
  payment_status?: 'paid' | 'pending' | 'overdue' | 'canceled';
  extend_days?: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verificar se usuário é super_admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Buscar perfil do usuário para verificar role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin role required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Processar diferentes métodos
    if (req.method === 'POST') {
      return await handleManualOverride(req, supabase, user.id, profile.full_name)
    }

    if (req.method === 'GET') {
      return await handleGetOverrideLogs(req, supabase)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Manual override API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleManualOverride(req: Request, supabase: any, superAdminId: string, adminName: string) {
  try {
    const requestData: OverrideRequest = await req.json()

    // Validar dados da requisição
    const validation = validateOverrideRequest(requestData)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { user_id, action, reason, access_status, payment_status, extend_days } = requestData

    // Buscar registro atual do usuário
    const { data: currentRecord, error: findError } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (findError) {
      console.error('Error finding user subscription:', findError)
      return new Response(
        JSON.stringify({ error: 'User subscription not found', details: findError }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Preparar dados para atualização
    const updateData = prepareUpdateData(action, currentRecord, {
      access_status,
      payment_status,
      extend_days
    })

    // Executar transação
    const result = await executeOverrideTransaction(
      supabase,
      user_id,
      currentRecord,
      updateData,
      reason,
      superAdminId,
      adminName,
      action
    )

    if (result.error) {
      return new Response(
        JSON.stringify({ error: 'Error executing override', details: result.error }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${action} successfully`,
        data: result.data,
        performed_by: adminName,
        performed_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in handleManualOverride:', error)
    return new Response(
      JSON.stringify({ error: 'Error processing override', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function handleGetOverrideLogs(req: Request, supabase: any) {
  try {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
    const userId = url.searchParams.get('user_id')
    const offset = (page - 1) * limit

    // Construir query
    let query = supabase
      .from('payment_logs')
      .select(`
        *,
        subscription_payments(user_id, profiles(email, full_name)),
        profiles:performed_by(email, full_name)
      `)
      .eq('action_type', 'manual_override')
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('subscription_payments.user_id', userId)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: logs, error: queryError, count } = await query

    if (queryError) {
      console.error('Error querying override logs:', queryError)
      return new Response(
        JSON.stringify({ error: 'Error querying logs', details: queryError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: logs || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in handleGetOverrideLogs:', error)
    return new Response(
      JSON.stringify({ error: 'Error getting logs', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

function validateOverrideRequest(data: OverrideRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.user_id) {
    errors.push('user_id is required')
  }

  if (!data.action) {
    errors.push('action is required')
  }

  const validActions = ['block', 'unblock', 'activate', 'suspend']
  if (data.action && !validActions.includes(data.action)) {
    errors.push(`action must be one of: ${validActions.join(', ')}`)
  }

  if (!data.reason || data.reason.trim().length < 3) {
    errors.push('reason is required and must be at least 3 characters')
  }

  if (data.extend_days && (data.extend_days < 1 || data.extend_days > 365)) {
    errors.push('extend_days must be between 1 and 365')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function prepareUpdateData(action: string, currentRecord: any, options: any) {
  const updateData: any = {
    manual_override: true,
    updated_at: new Date().toISOString()
  }

  switch (action) {
    case 'block':
      updateData.access_status = 'blocked'
      updateData.payment_status = options.payment_status || currentRecord.payment_status
      break

    case 'unblock':
    case 'activate':
      updateData.access_status = 'active'
      updateData.payment_status = options.payment_status || 'paid'
      updateData.days_overdue = 0
      if (options.extend_days) {
        const newDueDate = new Date()
        newDueDate.setDate(newDueDate.getDate() + options.extend_days)
        updateData.due_date = newDueDate.toISOString().split('T')[0]
      }
      break

    case 'suspend':
      updateData.access_status = 'suspended'
      updateData.payment_status = options.payment_status || currentRecord.payment_status
      break

    default:
      throw new Error(`Unknown action: ${action}`)
  }

  return updateData
}

async function executeOverrideTransaction(
  supabase: any,
  userId: string,
  currentRecord: any,
  updateData: any,
  reason: string,
  superAdminId: string,
  adminName: string,
  action: string
) {
  try {
    // 1. Atualizar subscription_payments
    const { data: updatedRecord, error: updateError } = await supabase
      .from('subscription_payments')
      .update({
        ...updateData,
        override_reason: reason,
        override_by: superAdminId
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating subscription:', updateError)
      return { error: updateError }
    }

    // 2. Criar log da ação
    const { error: logError } = await supabase
      .from('payment_logs')
      .insert({
        subscription_payment_id: updatedRecord.id,
        action_type: 'manual_override',
        old_status: currentRecord.payment_status,
        new_status: updatedRecord.payment_status,
        old_access_status: currentRecord.access_status,
        new_access_status: updatedRecord.access_status,
        manual_reason: reason,
        performed_by: superAdminId,
        stripe_event_data: {
          action,
          admin_name: adminName,
          timestamp: new Date().toISOString(),
          changes: updateData
        },
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Error creating log:', logError)
      // Não falhar a operação principal por erro de log
    }

    // 3. Opcional: Criar notificação para o usuário
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: getNotificationTitle(action),
        message: getNotificationMessage(action, reason),
        type: 'admin_action',
        created_at: new Date().toISOString()
      })

    if (notificationError) {
      console.error('Error creating notification:', notificationError)
      // Não falhar a operação principal
    }

    return { success: true, data: updatedRecord }

  } catch (error) {
    console.error('Error in transaction:', error)
    return { error: error.message }
  }
}

function getNotificationTitle(action: string): string {
  switch (action) {
    case 'block': return 'Conta Bloqueada'
    case 'unblock': return 'Conta Desbloqueada'
    case 'activate': return 'Conta Ativada'
    case 'suspend': return 'Conta Suspensa'
    default: return 'Alteração na Conta'
  }
}

function getNotificationMessage(action: string, reason: string): string {
  const baseMessages = {
    block: 'Sua conta foi bloqueada pela administração.',
    unblock: 'Sua conta foi desbloqueada pela administração.',
    activate: 'Sua conta foi ativada pela administração.',
    suspend: 'Sua conta foi suspensa pela administração.'
  }

  const baseMessage = baseMessages[action as keyof typeof baseMessages] || 'Sua conta sofreu alterações.'
  return `${baseMessage} Motivo: ${reason}`
}