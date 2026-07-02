// calculate-prazo — cálculo determinístico de prazos processuais (CPC + Juizado).
// Arquivo único (lógica de prazos_cpc inline) para facilitar o deploy.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────── Cálculo de prazos ───────────────────────────
interface PrazoResult {
  data_intimacao: string;
  data_fim_prazo: string | null;
  dias_uteis: number | null;
  base_legal: string;
  prazo_no_texto: number | null;
  eh_juizado: boolean;
  dias_corridos: boolean;
}

const FERIADOS_FIXOS: Array<[number, number]> = [
  [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25],
];

function pascoa(ano: number): Date {
  const a = ano % 19, b = ano % 4, c = ano % 7;
  const d = (19 * a + 24) % 30, e = (2 * b + 4 * c + 6 * d + 5) % 7;
  let dia = 22 + d + e, mes = 3;
  if (dia > 31) { dia -= 31; mes = 4; if (d === 29 && e === 6) dia = 19; else if (d === 28 && e === 6 && a > 10) dia = 18; }
  return new Date(ano, mes - 1, dia);
}
function toISO(d: Date): string { return d.toISOString().split('T')[0]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function feriadosMoveis(ano: number): Set<string> {
  const p = pascoa(ano);
  const sextaSanta = addDays(p, -2);
  const corpus = addDays(p, 60);
  return new Set([toISO(sextaSanta), toISO(corpus)]);
}
function ehFeriado(d: Date): boolean {
  const m = d.getMonth() + 1, dia = d.getDate();
  if (FERIADOS_FIXOS.some(([fm, fd]) => fm === m && fd === dia)) return true;
  return feriadosMoveis(d.getFullYear()).has(toISO(d));
}
function ehDiaUtil(d: Date): boolean { if (d.getDay() === 0 || d.getDay() === 6) return false; return !ehFeriado(d); }
function proximoDiaUtil(d: Date): Date { let r = addDays(d, 1); while (!ehDiaUtil(r)) r = addDays(r, 1); return r; }
function adicionarDiasUteis(dataInicio: Date, dias: number): Date {
  let d = new Date(dataInicio), contados = 0;
  while (contados < dias) { d = addDays(d, 1); if (ehDiaUtil(d)) contados++; }
  return d;
}
function ehJuizado(nomeOrgao: string | null | undefined): boolean { return (nomeOrgao ?? '').toUpperCase().includes('JUIZADO'); }

const PRAZOS_CPC: Record<string, [number | null, string]> = {
  'Sentença': [15, 'Apelação — Art. 1.003 c/c Art. 1.009 CPC'],
  'Acórdão': [15, 'Recurso — Art. 1.003 CPC'],
  'Decisão': [15, 'Agravo de instrumento ou manifestação — Art. 1.003 CPC'],
  'Despacho': [5, 'Manifestação — Art. 218 §3 CPC'],
  'Certidão': [5, 'Manifestação — Art. 218 §3 CPC'],
  'Edital': [null, 'Prazo especificado no edital — verificar manualmente'],
};
const PRAZO_PADRAO_CPC: [number, string] = [15, 'Manifestação — Art. 218 §3 CPC'];
const PRAZOS_JUIZADO: Record<string, [number | null, string]> = {
  'Sentença': [10, 'Recurso inominado — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Acórdão': [10, 'Recurso — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Decisão': [10, 'Recurso — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Despacho': [5, 'Embargos de declaração — Art. 49 Lei 9.099/95 (dias corridos)'],
  'Certidão': [5, 'Manifestação — Art. 49 Lei 9.099/95 (dias corridos)'],
  'Edital': [null, 'Prazo especificado no edital — verificar manualmente'],
};
const PRAZO_PADRAO_JUIZADO: [number, string] = [10, 'Manifestação — Art. 41 Lei 9.099/95 (dias corridos)'];

const RE_PRAZO = /(?:prazo\s+de\s+|no\s+prazo\s+de\s+|fixo\s+o\s+prazo\s+de\s+)(\d+)\s*(?:\([^)]+\)\s*)?\s*dias?/i;
function extrairPrazoTexto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = RE_PRAZO.exec(texto);
  return m ? parseInt(m[1], 10) : null;
}

function calcularPrazo(dataDisponibilizacao: string, tipoDocumento: string | null | undefined, nomeOrgao?: string | null, texto?: string | null): PrazoResult {
  const dataBase = new Date(dataDisponibilizacao + 'T12:00:00');
  const juizado = ehJuizado(nomeOrgao);
  const prazoNoTexto = extrairPrazoTexto(texto);
  const dataIntimacao = proximoDiaUtil(dataBase);
  const tabela = juizado ? PRAZOS_JUIZADO : PRAZOS_CPC;
  const padrao = juizado ? PRAZO_PADRAO_JUIZADO : PRAZO_PADRAO_CPC;
  const tipo = tipoDocumento ?? '';
  let [dias, baseLegal] = tabela[tipo] ?? padrao;
  if (prazoNoTexto !== null) { dias = prazoNoTexto; baseLegal = `Prazo de ${dias} dias mencionado no texto — verificar base legal`; }
  if (dias === null) {
    return { data_intimacao: toISO(dataIntimacao), data_fim_prazo: null, dias_uteis: null, base_legal: baseLegal, prazo_no_texto: prazoNoTexto, eh_juizado: juizado, dias_corridos: juizado };
  }
  const dataFim = juizado ? addDays(dataIntimacao, dias) : adicionarDiasUteis(dataIntimacao, dias);
  return { data_intimacao: toISO(dataIntimacao), data_fim_prazo: toISO(dataFim), dias_uteis: dias, base_legal: baseLegal, prazo_no_texto: prazoNoTexto, eh_juizado: juizado, dias_corridos: juizado };
}

// ─────────────────────────── HTTP handler ───────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { publicacao_id, data_disponibilizacao, tipo_documento, nome_orgao, conteudo } = await req.json();

    if (!data_disponibilizacao) {
      return new Response(JSON.stringify({ error: 'data_disponibilizacao é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resultado = calcularPrazo(data_disponibilizacao, tipo_documento, nome_orgao, conteudo);

    if (publicacao_id) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: pub } = await supabase.from('publicacoes').select('office_id, numero_processo').eq('id', publicacao_id).single();
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

    return new Response(JSON.stringify(resultado), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
