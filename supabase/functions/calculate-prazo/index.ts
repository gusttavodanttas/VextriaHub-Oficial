import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calcularPrazo } from './prazos_cpc.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { publicacao_id, data_disponibilizacao, tipo_documento, nome_orgao, conteudo } = await req.json();

    if (!data_disponibilizacao) {
      return new Response(JSON.stringify({ error: 'data_disponibilizacao é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultado = calcularPrazo(data_disponibilizacao, tipo_documento, nome_orgao, conteudo);

    // Se publicacao_id fornecido, persiste na tabela prazos
    if (publicacao_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Busca office_id da publicação
      const { data: pub } = await supabase
        .from('publicacoes')
        .select('office_id, numero_processo')
        .eq('id', publicacao_id)
        .single();

      if (pub) {
        await supabase.from('prazos').upsert({
          publicacao_id,
          office_id: pub.office_id,
          numero_processo: pub.numero_processo,
          tipo_prazo: tipo_documento ?? 'Desconhecido',
          data_disponibilizacao,
          data_intimacao: resultado.data_intimacao,
          data_fim_prazo: resultado.data_fim_prazo,
          dias_uteis: resultado.dias_uteis,
          base_legal: resultado.base_legal,
          eh_juizado: resultado.eh_juizado,
          dias_corridos: resultado.dias_corridos,
        }, { onConflict: 'publicacao_id' });
      }
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
