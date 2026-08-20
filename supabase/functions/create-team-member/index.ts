import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cria um membro de equipe (usuário + vínculo no escritório). Usa service_role,
// então PRECISA autorizar o chamador: só super_admin OU admin/owner ATIVO do
// escritório alvo. O papel é travado em 'user'/'admin' (nunca super_admin/owner
// por aqui) — senão qualquer um viraria super admin passando role no corpo.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const service = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) Autentica o chamador (JWT do usuário logado)
    const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const { data: { user: caller } } = await asUser.auth.getUser()
    if (!caller) return json({ error: 'não autenticado' }, 401)

    const { full_name, email, password, office_id, role, permissions } = await req.json()
    if (!email || !password || !office_id) return json({ error: 'dados incompletos' }, 400)

    // 2) Autoriza: super_admin OU admin/owner ativo do MESMO escritório
    const { data: prof } = await service.from('profiles').select('role').eq('user_id', caller.id).maybeSingle()
    const isSuper = prof?.role === 'super_admin'
    const { data: membership } = await service
      .from('office_users').select('role')
      .eq('user_id', caller.id).eq('office_id', office_id).eq('active', true).maybeSingle()
    const isOfficeAdmin = !!membership && ['admin', 'owner'].includes(String(membership.role))
    if (!isSuper && !isOfficeAdmin) return json({ error: 'sem permissão neste escritório' }, 403)

    // 2.1) Limite de usuários do plano — super_admin pode exceder (cortesia); admin não.
    if (!isSuper) {
      const { data: office } = await service.from('offices').select('max_users').eq('id', office_id).maybeSingle()
      const maxUsers = Number((office as { max_users?: number } | null)?.max_users) || 0
      if (maxUsers > 0) {
        const { count } = await service
          .from('office_users').select('id', { count: 'exact', head: true })
          .eq('office_id', office_id).eq('active', true)
        if ((count ?? 0) >= maxUsers)
          return json({ error: `Limite do plano atingido (${maxUsers} usuários). Faça upgrade para adicionar mais membros.` }, 400)
      }
    }

    // 3) Papel seguro: nunca super_admin/owner por este fluxo
    const safeRole = role === 'admin' ? 'admin' : 'user'

    const { data: existing } = await service
      .from('profiles').select('user_id').eq('email', email).maybeSingle()
    if (existing) return json({ error: 'E-mail já cadastrado no sistema.' }, 400)

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) return json({ error: authError.message }, 400)

    const userId = authData.user.id

    const { error: officeError } = await service.from('office_users').insert({
      user_id: userId, office_id, role: safeRole, active: true,
    })
    if (officeError) {
      await service.auth.admin.deleteUser(userId)
      return json({ error: officeError.message }, 400)
    }

    await service.from('profiles').upsert({
      user_id: userId, email, full_name: full_name || null, office_id, role: safeRole,
    }, { onConflict: 'user_id' })

    if (permissions && permissions.length > 0) {
      await service.from('user_permissions').insert(
        permissions.map((p: { key: string; granted: boolean }) => ({
          office_id, user_id: userId, permission_key: p.key, granted: p.granted,
        }))
      )
    }

    return json({ user_id: userId }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
