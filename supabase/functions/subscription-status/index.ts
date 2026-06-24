import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueryParams {
  page?: string;
  limit?: string;
  status?: string;
  access_status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
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
      .select('role')
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
    if (req.method === 'GET') {
      return await handleGetSubscriptions(req, supabase)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Subscription status API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleGetSubscriptions(req: Request, supabase: any) {
  try {
    const url = new URL(req.url)
    const params: QueryParams = {
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '50',
      status: url.searchParams.get('status') || undefined,
      access_status: url.searchParams.get('access_status') || undefined,
      search: url.searchParams.get('search') || undefined,
      sort_by: url.searchParams.get('sort_by') || 'updated_at',
      sort_order: (url.searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'
    }

    // Validar parâmetros
    const page = Math.max(1, parseInt(params.page || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50'))) // Max 100 items per page
    const offset = (page - 1) * limit

    // Construir query base
    let query = supabase
      .from('subscription_payments')
      .select(`
        *,
        profiles:user_id(id, email, full_name, created_at),
        offices:office_id(id, name, created_at)
      `)

    // Aplicar filtros
    if (params.status) {
      query = query.eq('payment_status', params.status)
    }

    if (params.access_status) {
      query = query.eq('access_status', params.access_status)
    }

    // Filtro de busca (por nome, email)
    if (params.search) {
      query = query.or(
        `profiles.full_name.ilike.%${params.search}%,` +
        `profiles.email.ilike.%${params.search}%,` +
        `offices.name.ilike.%${params.search}%`
      )
    }

    // Aplicar ordenação
    const validSortFields = ['updated_at', 'created_at', 'due_date', 'payment_status', 'access_status', 'days_overdue']
    const sortBy = validSortFields.includes(params.sort_by || '') ? params.sort_by : 'updated_at'
    const sortOrder = params.sort_order === 'asc' ? true : false

    query = query.order(sortBy!, { ascending: sortOrder })

    // Aplicar paginação
    query = query.range(offset, offset + limit - 1)

    const { data: subscriptions, error: queryError, count } = await query

    if (queryError) {
      console.error('Error querying subscriptions:', queryError)
      return new Response(
        JSON.stringify({ error: 'Error querying subscriptions', details: queryError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Buscar estatísticas gerais
    const stats = await getSubscriptionStats(supabase)

    // Preparar resposta
    const response = {
      success: true,
      data: subscriptions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
        has_next: offset + limit < (count || 0),
        has_prev: page > 1
      },
      stats: stats.data || {},
      filters_applied: {
        status: params.status,
        access_status: params.access_status,
        search: params.search
      },
      generated_at: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in handleGetSubscriptions:', error)
    return new Response(
      JSON.stringify({ error: 'Error processing request', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function getSubscriptionStats(supabase: any) {
  try {
    // Buscar estatísticas agregadas
    const { data: statsData, error: statsError } = await supabase
      .from('subscription_payments')
      .select('payment_status, access_status, monthly_fee')

    if (statsError) {
      console.error('Error getting stats:', statsError)
      return { error: statsError }
    }

    // Calcular estatísticas
    const stats = {
      total_users: statsData?.length || 0,
      active_users: statsData?.filter((s: any) => s.access_status === 'active').length || 0,
      blocked_users: statsData?.filter((s: any) => s.access_status === 'blocked').length || 0,
      suspended_users: statsData?.filter((s: any) => s.access_status === 'suspended').length || 0,
      paid_users: statsData?.filter((s: any) => s.payment_status === 'paid').length || 0,
      overdue_users: statsData?.filter((s: any) => s.payment_status === 'overdue').length || 0,
      pending_users: statsData?.filter((s: any) => s.payment_status === 'pending').length || 0,
      total_revenue: statsData?.reduce((sum: number, s: any) => sum + (parseFloat(s.monthly_fee) || 0), 0) || 0,
      paid_revenue: statsData
        ?.filter((s: any) => s.payment_status === 'paid')
        ?.reduce((sum: number, s: any) => sum + (parseFloat(s.monthly_fee) || 0), 0) || 0
    }

    // Buscar usuários em risco (próximo ao vencimento)
    const { data: overdueData, error: overdueError } = await supabase
      .from('subscription_payments')
      .select('days_overdue')
      .gte('days_overdue', 1)
      .order('days_overdue', { ascending: false })

    if (!overdueError) {
      stats.users_at_risk = overdueData?.filter((s: any) => s.days_overdue >= 1 && s.days_overdue <= 7).length || 0
      stats.max_overdue_days = overdueData?.[0]?.days_overdue || 0
    }

    return { data: stats }

  } catch (error) {
    console.error('Error calculating stats:', error)
    return { error: error.message }
  }
}