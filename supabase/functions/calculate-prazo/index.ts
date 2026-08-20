// calculate-prazo — cálculo determinístico de prazos processuais (CPC + Juizado).
// Arquivo único (lógica de prazos_cpc inline) para facilitar o deploy.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte o HTML do diário oficial em texto legível (teor do prazo)
function limparHTML(html: string): string {
  if (!html) return '';
  let t = html;
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/p>|<\/div>|<\/tr>/gi, '\n');
  t = t.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<[^>]*>/g, '');
  const ents: Record<string, string> = {
    '&nbsp;': ' ', '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&ordm;': 'º', '&ordf;': 'ª', '&agrave;': 'à', '&aacute;': 'á',
    '&acirc;': 'â', '&atilde;': 'ã', '&eacute;': 'é', '&ecirc;': 'ê',
    '&iacute;': 'í', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
    '&uacute;': 'ú', '&ccedil;': 'ç',
  };
  for (const [k, v] of Object.entries(ents)) t = t.replace(new RegExp(k, 'gi'), v);
  return t.split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

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

// ATENÇÃO: esta lógica DEVE espelhar src/lib/prazoCalc.ts (o motor coberto por teste).
// Divergência = prazo errado = risco de perda de prazo. Base legal: dias úteis (CPC art. 219);
// feriados fixos + móveis derivados da Páscoa por Meeus/Butcher (Carnaval seg/ter, Sexta-feira
// Santa, Corpus Christi); recesso forense 20/12–20/01 inclusive (CPC art. 220 — prazos suspensos).
const FERIADOS_FIXOS = new Set([
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25',
]);
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toISO(d: Date): string { return d.toISOString().split('T')[0]; }
const mmddOf = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Domingo de Páscoa (Meeus/Butcher) — MESMO algoritmo de prazoCalc.ts
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
const _movableCache: Record<number, Set<string>> = {};
function feriadosMoveis(ano: number): Set<string> {
  if (_movableCache[ano]) return _movableCache[ano];
  const p = pascoa(ano);
  const set = new Set([
    mmddOf(addDays(p, -48)), // Carnaval (segunda)
    mmddOf(addDays(p, -47)), // Carnaval (terça)
    mmddOf(addDays(p, -2)),  // Sexta-feira Santa
    mmddOf(addDays(p, 60)),  // Corpus Christi
  ]);
  _movableCache[ano] = set;
  return set;
}
// Recesso forense: 20/12 a 20/01 inclusive (CPC art. 220) — prazos suspensos
function ehRecesso(d: Date): boolean {
  const mo = d.getMonth() + 1, day = d.getDate();
  return (mo === 12 && day >= 20) || (mo === 1 && day <= 20);
}
function ehFeriado(d: Date): boolean {
  const mmdd = mmddOf(d);
  return FERIADOS_FIXOS.has(mmdd) || feriadosMoveis(d.getFullYear()).has(mmdd);
}
function ehDiaUtil(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !ehFeriado(d) && !ehRecesso(d);
}
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

// ─────────── Detecção de "possível audiência" (item 5, abordagem A) ───────────
// Marca o prazo e SUGERE data/hora/tipo quando o teor fala de audiência. O usuário
// confirma num clique no front — NUNCA agenda sozinho (data errada = ato perdido).
const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
function tipoAudienciaDetectado(t: string): string | null {
  if (/concilia/i.test(t)) return 'Audiência de Conciliação';
  if (/instru/i.test(t)) return 'Audiência de Instrução';
  if (/justifica/i.test(t)) return 'Audiência de Justificação';
  if (/\buna\b/i.test(t)) return 'Audiência UNA';
  if (/saneamento/i.test(t)) return 'Audiência de Saneamento';
  if (/debates/i.test(t)) return 'Audiência de Debates';
  if (/trabalhista/i.test(t)) return 'Audiência Trabalhista';
  if (/criminal|penal/i.test(t)) return 'Audiência Criminal';
  return null;
}
function analisarAudiencia(texto: string | null | undefined, dataBase: Date): { possivel: boolean; data: string | null; hora: string | null; tipo: string | null } {
  const t = texto || '';
  if (!/audi[êe]ncia/i.test(t)) return { possivel: false, data: null, hora: null, tipo: null };
  const cand: number[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)) {
    const d = +m[1], mo = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) cand.push(new Date(y, mo - 1, d, 12).getTime());
  }
  for (const m of t.matchAll(/\b(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})\b/gi)) {
    const mo = MESES_PT[m[2].toLowerCase()]; const d = +m[1], y = +m[3];
    if (mo && d >= 1 && d <= 31) cand.push(new Date(y, mo - 1, d, 12).getTime());
  }
  const futuras = cand.filter((ms) => ms > dataBase.getTime()).sort((a, b) => a - b);
  const data = futuras.length ? new Date(futuras[0]).toISOString().split('T')[0] : null;
  let hora: string | null = null;
  const mh = /\b(\d{1,2})\s*h(?:oras|s)?\s*(\d{2})?\b/i.exec(t) || /\b(\d{1,2}):(\d{2})\b/.exec(t);
  if (mh && +mh[1] <= 23) hora = `${String(+mh[1]).padStart(2, '0')}:${mh[2] || '00'}`;
  return { possivel: true, data, hora, tipo: tipoAudienciaDetectado(t) };
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
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
      const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: pub } = await supabase.from('publicacoes')
        .select('office_id, numero_processo, processo_id, titulo, conteudo')
        .eq('id', publicacao_id).single();
      if (pub) {
        // AUTORIZAÇÃO (o write grava prazo pelo office_id da publicação): robô via
        // x-robot-secret, OU usuário logado membro ATIVO do escritório da publicação.
        // Sem isso, qualquer um sobrescreveria o prazo (onConflict:publicacao_id) alheio.
        const ROBOT_SECRET = Deno.env.get('ROBOT_SECRET') ?? '';
        const isRobot = !!ROBOT_SECRET && req.headers.get('x-robot-secret') === ROBOT_SECRET;
        if (!isRobot) {
          const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
          });
          const { data: { user } } = await asUser.auth.getUser();
          if (!user) {
            return new Response(JSON.stringify({ error: 'não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const { data: mem } = await supabase.from('office_users').select('id')
            .eq('user_id', user.id).eq('office_id', pub.office_id).eq('active', true).maybeSingle();
          if (!mem) {
            return new Response(JSON.stringify({ error: 'sem permissão neste escritório' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
        // Teor completo da publicação + título legível, para o prazo ser autoexplicativo
        const teor = limparHTML(conteudo || pub.conteudo || '');
        const titulo = (pub.titulo || '').trim()
          || `${tipo_documento || 'Intimação'}${pub.numero_processo ? ` · ${pub.numero_processo}` : ''}`;

        // Sugestão de audiência (o usuário confirma no front; não agenda sozinho)
        const aud = analisarAudiencia(teor, new Date(data_disponibilizacao + 'T12:00:00'));

        const payload: Record<string, unknown> = {
          publicacao_id,
          office_id: pub.office_id,
          numero_processo: pub.numero_processo,
          processo_id: pub.processo_id ?? null,
          titulo,
          descricao: teor || null,
          tipo_prazo: tipo_documento ?? 'Desconhecido',
          data_disponibilizacao,
          data_intimacao: resultado.data_intimacao,
          data_fim_prazo: resultado.data_fim_prazo,
          dias_uteis: resultado.dias_uteis,
          base_legal: resultado.base_legal,
          eh_juizado: resultado.eh_juizado,
          dias_corridos: resultado.dias_corridos,
          possivel_audiencia: aud.possivel,
          audiencia_data_sugerida: aud.data,
          audiencia_hora_sugerida: aud.hora,
          audiencia_tipo_sugerido: aud.tipo,
        };

        const { error } = await supabase.from('prazos').upsert(payload, { onConflict: 'publicacao_id' });
        if (error) {
          // Resiliente: se alguma coluna nova não existir no schema (ex.: migration ainda não
          // aplicada), grava sem elas — inclusive os campos de sugestão de audiência.
          const { titulo: _t, descricao: _d, processo_id: _p,
            possivel_audiencia: _pa, audiencia_data_sugerida: _ad,
            audiencia_hora_sugerida: _ah, audiencia_tipo_sugerido: _at, ...base } = payload;
          await supabase.from('prazos').upsert(base, { onConflict: 'publicacao_id' });
        }
      }
    }

    return new Response(JSON.stringify(resultado), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
