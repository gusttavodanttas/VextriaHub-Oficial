import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ManageAccessRequest {
  office_id: string;
  action: 'apply_discount' | 'grant_lifetime' | 'revoke_lifetime';
  discount_percent?: number;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar Autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Invalid authentication')

    // 2. Verificar se é Super Admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      throw new Error('Access denied. Super admin role required.')
    }

    // 3. Processar Requisição
    const { office_id, action, discount_percent, reason }: ManageAccessRequest = await req.json()
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY not configured')

    // Buscar info da assinatura
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('office_id', office_id)
      .maybeSingle()

    let stripeResult = null;

    if (action === 'apply_discount') {
      if (!sub?.stripe_subscription_id) throw new Error('Escritório não possui assinatura Stripe ativa')
      if (!discount_percent) throw new Error('Percentual de desconto é obrigatório')

      // Criar Cupom Dinamicamente
      const couponResponse = await fetch('https://api.stripe.com/v1/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          percent_off: discount_percent.toString(),
          duration: 'forever',
          name: `Desconto Manual ${discount_percent}% (Admin)`
        }).toString()
      })
      const coupon = await couponResponse.json()
      if (coupon.error) throw new Error(`Erro Stripe Coupon: ${coupon.error.message}`)

      // Aplicar na assinatura
      const subUpdateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'discounts[0][coupon]': coupon.id
        }).toString()
      })
      stripeResult = await subUpdateResponse.json()
      if (stripeResult.error) throw new Error(`Erro Stripe Sub: ${stripeResult.error.message}`)

      // Atualizar Banco
      await supabase
        .from('subscriptions')
        .update({ 
          manual_discount_percent: discount_percent,
          stripe_coupon_id: coupon.id
        })
        .eq('office_id', office_id)
    }

    if (action === 'grant_lifetime') {
      // Se houver Stripe, cancela a renovação
      if (sub?.stripe_subscription_id) {
        await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            cancel_at_period_end: 'true'
          }).toString()
        })
      }

      // Conceder Acesso Permanente no Banco
      await supabase.from('offices').update({ access_type: 'lifetime', plan: 'lifetime' }).eq('id', office_id)
      
      // Upsert Subscription (Manual)
      const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('office_id', office_id).maybeSingle()
      
      const lifetimeData = {
        office_id,
        plan: 'premium',
        status: 'active',
        end_date: '2099-12-31T23:59:59Z',
        is_trial: false
      }

      if (existingSub) {
        await supabase.from('subscriptions').update(lifetimeData).eq('id', existingSub.id)
      } else {
        await supabase.from('subscriptions').insert(lifetimeData)
      }
    }

    // 4. Registrar Auditoria
    await supabase.from('office_access_changes').insert({
      office_id,
      changed_by: user.id,
      action,
      details: { reason, discount_percent, stripe_result: stripeResult }
    })

    return new Response(
      JSON.stringify({ success: true, action }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Manage Access error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
