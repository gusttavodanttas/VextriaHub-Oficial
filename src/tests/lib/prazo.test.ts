// prazoStatus: vencido / hoje / amanhã / futuro com rótulo e classe.
import { describe, it, expect } from 'vitest';
import { prazoStatus } from '@/lib/prazo';

const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

describe('prazoStatus', () => {
  it('classifica por distância em dias (data-only e ISO com hora)', () => {
    expect(prazoStatus(emDias(-3))).toMatchObject({ vencido: true, hoje: false, dias: -3, label: 'Atrasado 3d', cls: expect.stringContaining('rose') });
    expect(prazoStatus(emDias(0))).toMatchObject({ vencido: false, hoje: true, dias: 0, label: 'Vence hoje', cls: expect.stringContaining('orange') });
    expect(prazoStatus(emDias(1))).toMatchObject({ dias: 1, label: 'Vence amanhã', cls: 'text-muted-foreground' });
    expect(prazoStatus(`${emDias(5)}T23:59:00Z`)).toMatchObject({ dias: 5, label: 'Em 5d' });
  });

  it('vazio ou inválido devolve null', () => {
    expect(prazoStatus(null)).toBeNull();
    expect(prazoStatus('')).toBeNull();
    expect(prazoStatus('não é data')).toBeNull();
  });
});
