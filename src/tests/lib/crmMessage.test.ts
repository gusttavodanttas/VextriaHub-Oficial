// Mensagem de retomada de contato e links de WhatsApp/e-mail.
import { describe, it, expect } from 'vitest';
import { gerarMensagemContato, linkWhatsapp, linkEmail } from '@/lib/crmMessage';

describe('crmMessage', () => {
  it('usa só o primeiro nome e assina com o remetente quando houver', () => {
    expect(gerarMensagemContato({ nome: '  Maria da Silva ' }, 'Dr. Gustavo')).toBe(
      'Olá, Maria! Tudo bem? Estou retomando seu atendimento para dar continuidade. Você tem disponibilidade para conversarmos?\n\nFico à disposição,\nDr. Gustavo',
    );
    expect(gerarMensagemContato({})).toMatch(/^Olá! Tudo bem\?.*\n\nFico à disposição\.$/s);
  });

  it('links com DDI 55, só dígitos e texto codificado', () => {
    expect(linkWhatsapp('(61) 99999-8888', 'Olá, tudo bem?')).toBe('https://wa.me/5561999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F');
    expect(linkEmail('a@b.c', 'corpo & tal')).toBe('mailto:a@b.c?subject=Retomada%20de%20contato&body=corpo%20%26%20tal');
    expect(linkEmail('a@b.c', 'x', 'Outro')).toContain('subject=Outro');
  });
});
