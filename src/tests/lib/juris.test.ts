// Regras do acervo de jurisprudência: o que é precedente, títulos/datas, citação
// pronta, destaque do snippet e sugestão de termos.
import { describe, it, expect } from 'vitest';
import { isPrecedente, sourceLabel, tipoLabel, docTitulo, docData, fmtData, urlIgual, citacao, splitSnippet, sugerirTermos, type JurisDoc } from '@/lib/juris';

const base: JurisDoc = {
  doc_id: 'd1', source_id: 'stj_integras', court: 'STJ', document_type: 'acordao', organ: 'Terceira Turma', case_number: 'REsp 1.234.567/SP',
  decision_number: null, class_name: null, rapporteur: 'Min. Nancy Andrighi', judgment_date: '2026-03-10', publication_date: '2026-03-20',
  title: 'Dano moral', summary: null, official_url: 'https://stj.jus.br/x', metadata: null,
};

describe('juris', () => {
  it('ato normativo e metadado processual nunca são precedente', () => {
    expect(isPrecedente(base)).toBe(true);
    expect(isPrecedente({ document_type: 'ato_normativo' })).toBe(false);
    expect(isPrecedente({ document_type: 'metadado_processual' })).toBe(false);
  });

  it('rótulos caem pro próprio id quando desconhecidos', () => {
    expect(sourceLabel('stj_integras')).toBe('STJ · inteiro teor');
    expect(sourceLabel('xyz')).toBe('xyz');
    expect(tipoLabel('sumula')).toBe('Súmula');
    expect(tipoLabel('outro')).toBe('outro');
  });

  it('título e data por prioridade; fmtData aceita ISO longo e vazio', () => {
    expect(docTitulo(base)).toBe('REsp 1.234.567/SP');
    expect(docTitulo({ ...base, case_number: null, decision_number: 'Dec 9' })).toBe('Dec 9');
    expect(docTitulo({ ...base, case_number: null, title: null })).toBe('d1');
    expect(docData(base)).toBe('2026-03-10');
    expect(docData({ ...base, judgment_date: null })).toBe('2026-03-20');
    expect(docData({ ...base, judgment_date: null, publication_date: null })).toBeNull();
    expect(fmtData('2026-03-10T15:00:00Z')).toBe('10/03/2026');
    expect(fmtData(null)).toBe('—');
    expect(fmtData('2026')).toBe('2026');
  });

  it('urlIgual ignora espaços e barras finais', () => {
    expect(urlIgual(' https://a.b/x/// ', 'https://a.b/x')).toBe(true);
    expect(urlIgual('https://a.b/x', 'https://a.b/y')).toBe(false);
  });

  it('citação de precedente e de ato normativo', () => {
    expect(citacao(base)).toBe('STJ, REsp 1.234.567/SP, Rel. Min. Nancy Andrighi, Terceira Turma, julgado em 10/03/2026, publicado em 20/03/2026. Disponível em: https://stj.jus.br/x.');
    expect(citacao({ ...base, court: null, rapporteur: null, organ: null, judgment_date: null, publication_date: null })).toBe('REsp 1.234.567/SP. Disponível em: https://stj.jus.br/x.');
    expect(citacao({ ...base, document_type: 'ato_normativo', title: 'Resolução 500', organ: 'ANS', publication_date: '2026-01-05' })).toBe('Resolução 500 (ANS), publicado em 05/01/2026. Disponível em: https://stj.jus.br/x.');
  });

  it('splitSnippet separa os trechos destacados', () => {
    expect(splitSnippet('a [b] c [d]')).toEqual([{ t: 'a ', hit: false }, { t: 'b', hit: true }, { t: ' c ', hit: false }, { t: 'd', hit: true }]);
    expect(splitSnippet('[x]')).toEqual([{ t: 'x', hit: true }]);
    expect(splitSnippet('sem destaque')).toEqual([{ t: 'sem destaque', hit: false }]);
    expect(splitSnippet(null)).toEqual([]);
  });

  it('sugerirTermos ignora palavras curtas e ruído e ordena por frequência', () => {
    const texto = 'Intimação: a parte autora deve apresentar contrarrazões. Contrarrazões ao recurso especial, prazo de 15 dias. Recurso Especial admitido.';
    expect(sugerirTermos(texto, 3)).toBe('contrarrazões recurso especial');
    expect(sugerirTermos('')).toBe('');
  });
});
