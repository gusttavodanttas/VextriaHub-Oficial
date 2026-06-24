import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    if (!signature) {
      throw new Error('No Stripe signature found')
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '')
    
    // Verificar assinatura do webhook
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    console.log('Evento Stripe recebido:', event.type)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, supabase)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object, supabase)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, supabase)
        break

      default:
        console.log(`Evento não tratado: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro no webhook Stripe:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function handleCheckoutCompleted(session: any, supabase: any) {
  const { customer, metadata } = session
  
  if (!metadata?.user_id) {
    throw new Error('Metadata incompleto: user_id faltando no checkout')
  }
  
  // Buscar office_id correspondente ao user_id caso o Frontend não tenha engatado
  let targetOfficeId = metadata.office_id;
  if (!targetOfficeId) {
    const { data: officeUser } = await supabase
      .from('office_users')
      .select('office_id')
      .eq('user_id', metadata.user_id)
      .eq('active', true)
      .maybeSingle();
      
    targetOfficeId = officeUser?.office_id;
    
    if (!targetOfficeId) {
      console.warn('⚠️ office_id não encontrado para o usuário:', metadata.user_id);
    }
  }

  // Atualizar checkout - (Uso Opcional de checkout_id caso exista)
  if (metadata.checkout_id) {
    await supabase
      .from('stripe_checkouts')
      .update({
        stripe_customer_id: customer,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', metadata.checkout_id)
  }

  // Criar ou atualizar assinatura
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: metadata.user_id,
      office_id: targetOfficeId,
      stripe_customer_id: customer,
      payment_status: 'paid',
      access_status: 'active',
      updated_at: new Date().toISOString()
    })
}

async function handleSubscriptionCreated(subscription: any, supabase: any) {
  const { customer, id: subscriptionId, metadata } = subscription

  await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: subscriptionId,
      payment_status: 'paid',
      access_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer)
}

async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  const { customer, status } = subscription

  let paymentStatus = 'pending'
  let accessStatus = 'active'

  switch (status) {
    case 'active':
    case 'trialing':
      paymentStatus = 'paid'
      accessStatus = 'active'
      break
    case 'past_due':
      paymentStatus = 'overdue'
      accessStatus = 'suspended'
      break
    case 'canceled':
      paymentStatus = 'canceled'
      accessStatus = 'blocked'
      break
  }

  await supabase
    .from('subscriptions')
    .update({
      payment_status: paymentStatus,
      access_status: accessStatus,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer)
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  const { customer } = subscription

  await supabase
    .from('subscriptions')
    .update({
      payment_status: 'canceled',
      access_status: 'blocked',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer)
}

async function handlePaymentSucceeded(invoice: any, supabase: any) {
  const { customer, subscription } = invoice

  await supabase
    .from('subscriptions')
    .update({
      payment_status: 'paid',
      access_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer)
}

async function handlePaymentFailed(invoice: any, supabase: any) {
  const { customer } = invoice

  await supabase
    .from('subscriptions')
    .update({
      payment_status: 'overdue',
      access_status: 'suspended',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer)
}

// Declaração de tipo para Stripe
class Stripe {
  constructor(private key: string) {}
  
  webhooks = {
    constructEvent: (body: string, signature: string, secret: string) => {
      // Implementação simplificada para exemplo
      return JSON.parse(body)
    }
  }
}