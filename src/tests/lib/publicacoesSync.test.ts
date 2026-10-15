// Mapeamento item da edge function → registro de publicação (extraído de
// hooks/usePublicacoes.tsx): o que o sync ignora, título, data, urgência e vínculo.
import { describe, it, expect } from 'vitest';
import { montarRegistroOab, montarRegistroCnj, dataPublicacaoDoItem, deriveUrgencia, soDigitos } from '@/lib/publicacoesSync';

const mapa = new Map([['00012345620268260100', 'proc-1']]);

describe('montarRegistroOab', () => {
  it('ignora andamentos do DataJud e conteúdo curto demais', () => {
    expect(montarRegistroOab({ fonte: 'datajud', conteudo: 'Intimação longa o bastante' }, mapa)).toBeNull();
    expect(montarRegistroOab({ fonte: 'pje', conteudo: 'curto' }, mapa)).toBeNull();
  });

  it('monta o registro com título do item, urgência derivada, tags e vínculo automático pelo CNJ', () => {
    const r = montarRegistroOab({
      numeroProcesso: '0001234-56.2026.8.26.0100', fonte: 'pje', titulo: 'Maria x Banco', tribunal: 'tjsp', vara: '2ª Vara',
      tipo_documento: 'Intimação', conteudo: 'Fica a parte intimada para manifestar-se no prazo de 15 dias.', data_disponibilizacao: '2026-10-10T12:00:00Z',
    }, mapa)!;
    expect(r).toMatchObject({
      titulo: 'Maria x Banco', numero_processo: '0001234-56.2026.8.26.0100', status: 'nova', urgencia: 'alta',
      tags: ['TJSP', 'pje_comunica'], tribunal: 'tjsp', vara: '2ª Vara', nome_orgao: '2ª Vara', processo_id: 'proc-1',
      data_publicacao: '2026-10-10',
    });
  });

  it('título genérico "Publicação…" cai pro tipo do documento; sem processo cadastrado → sem vínculo', () => {
    const r = montarRegistroOab({
      numeroProcesso: '9999', titulo: 'Publicação 9999', tipo_comunicacao: 'Edital', tribunal: null,
      ultimoAndamento: { descricao: 'Edital de citação publicado no diário', data: '2026-09-01T00:00:00Z' },
    }, mapa)!;
    expect(r.titulo).toBe('Edital');
    expect(r.conteudo).toBe('Edital de citação publicado no diário');
    expect(r.tags).toEqual(['TRIBUNAL', 'pje_comunica']);
    expect(r.processo_id).toBeNull();
    expect(r.data_publicacao).toBe('2026-09-01');
  });
});

describe('montarRegistroCnj', () => {
  it('DataJud: usa o último andamento (ou o 1º parágrafo do conteúdo); tag CNJ por padrão', () => {
    const r = montarRegistroCnj({ fonte: 'datajud', conteudo: 'Primeiro parágrafo\n\nSegundo', data_disponibilizacao: '2026-10-01' }, '123');
    expect(r.conteudo).toBe('Primeiro parágrafo');
    expect(r.titulo).toBe('Processo 123');
    expect(r.numero_processo).toBe('123');
    expect(r.tags).toEqual(['CNJ']);
    expect(montarRegistroCnj({ fonte: 'datajud', ultimoAndamento: { descricao: 'Juntada de petição' } }, '123').conteudo).toBe('Juntada de petição');
  });
});

describe('helpers', () => {
  it('dataPublicacaoDoItem cai pra hoje sem data; soDigitos limpa o CNJ', () => {
    expect(dataPublicacaoDoItem({})).toBe(new Date().toISOString().split('T')[0]);
    expect(soDigitos('0001234-56.2026.8.26.0100')).toBe('00012345620268260100');
    expect(soDigitos(null)).toBe('');
  });

  it('deriveUrgencia: termos de prazo/ato → alta', () => {
    expect(deriveUrgencia('Despacho de mero expediente')).toBe('media');
    expect(deriveUrgencia('Fica intimada', null)).toBe('alta');
    expect(deriveUrgencia(null, 'Citação')).toBe('alta');
  });
});
