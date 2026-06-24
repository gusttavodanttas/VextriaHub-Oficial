import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verifica que o chamador é super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verifica se quem chamou é super_admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: corsHeaders });

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Apenas super_admin pode criar usuários cortesia" }), { status: 403, headers: corsHeaders });
    }

    const { nome, email, senha, nome_escritorio, oab, oab_uf, plano } = await req.json();

    if (!nome || !email || !senha || !nome_escritorio) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: nome, email, senha, nome_escritorio" }), { status: 400, headers: corsHeaders });
    }

    // 1. Criar usuário no Auth (já confirmado)
    const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });

    if (userError) throw new Error(`Erro ao criar usuário: ${userError.message}`);
    const userId = newUser.user!.id;

    // 2. Atualizar perfil (trigger já criou, precisamos atualizar OAB e role)
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: nome, oab: oab || null, oab_uf: oab_uf || null })
      .eq("user_id", userId);

    // 3. Criar escritório
    const { data: office, error: officeError } = await supabaseAdmin
      .from("offices")
      .insert({
        name: nome_escritorio,
        email: email,
        plan: plano || "professional",
        max_users: 10,
        active: true,
        access_type: "courtesy",
        access_granted_by: caller.id,
        access_granted_at: new Date().toISOString(),
        access_note: "Acesso cortesia concedido via painel super_admin",
        created_by: caller.id,
      })
      .select()
      .single();

    if (officeError) throw new Error(`Erro ao criar escritório: ${officeError.message}`);

    // 4. Vincular usuário ao escritório como admin
    const { error: ouError } = await supabaseAdmin
      .from("office_users")
      .insert({
        office_id: office.id,
        user_id: userId,
        role: "admin",
        active: true,
        invited_by: caller.id,
      });

    if (ouError) throw new Error(`Erro ao vincular usuário: ${ouError.message}`);

    // 5. Atualizar office_id no perfil
    await supabaseAdmin
      .from("profiles")
      .update({ office_id: office.id })
      .eq("user_id", userId);

    // 6. Criar subscription cortesia (sem data de expiração = vitalício)
    await supabaseAdmin
      .from("subscriptions")
      .insert({
        office_id: office.id,
        plan: plano || "professional",
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
        end_date: "2099-12-31",
        price: 0,
        payment_status: "courtesy",
        access_status: "courtesy",
      });

    // 7. Registrar auditoria
    await supabaseAdmin
      .from("office_access_changes")
      .insert({
        office_id: office.id,
        changed_by: caller.id,
        action: "grant_courtesy",
        details: { nome, email, plano, nome_escritorio },
      });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        office_id: office.id,
        message: `Usuário ${nome} criado com acesso cortesia no escritório "${nome_escritorio}"`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
