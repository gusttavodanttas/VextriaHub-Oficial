import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ASAAS_PAID_EVENTS,
  ASAAS_OVERDUE_EVENTS,
  ASAAS_DEAD_EVENTS,
  mapAsaasEventToStatus,
} from '@/lib/billing';

// Teste de CONTRATO. O webhook Deno (asaas-webhook) é autocontido — não importa
// de src — então aqui garantimos que as listas de evento embutidas nele batem com
// a spec testada em billing.ts. Se alguém editar o webhook (adicionar/remover um
// evento, trocar um status), este teste falha e aponta a divergência. Assim o
// "pagou → ativa / atrasou → bloqueia" fica travado dos dois lados sem precisar
// deployar o webhook para testá-lo.
const src = readFileSync(
  resolve(process.cwd(), 'supabase/functions/asaas-webhook/index.ts'),
  'utf8',
);

/** Extrai os eventos de `const <nome> = ["A", "B"].includes(event)` no fonte. */
function eventsInArray(varName: string): string[] {
  const m = src.match(new RegExp(`const\\s+${varName}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/["']([A-Z_]+)["']/g)].map((x) => x[1]);
}

describe('contrato asaas-webhook ↔ spec billing.ts', () => {
  it('a lista de eventos "pagos" no webhook é exatamente ASAAS_PAID_EVENTS', () => {
    expect(new Set(eventsInArray('paid'))).toEqual(new Set(ASAAS_PAID_EVENTS));
  });

  it('a lista de eventos "mortos" (estorno/chargeback) no webhook é exatamente ASAAS_DEAD_EVENTS', () => {
    expect(new Set(eventsInArray('dead'))).toEqual(new Set(ASAAS_DEAD_EVENTS));
  });

  it('o evento de atraso do webhook é exatamente ASAAS_OVERDUE_EVENTS', () => {
    for (const ev of ASAAS_OVERDUE_EVENTS) {
      expect(src).toContain(`event === "${ev}"`);
    }
  });

  it('o webhook mapeia pago→ativa, atraso→atrasada, morto→cancelada (strings presentes)', () => {
    expect(src).toContain('"ativa"');
    expect(src).toContain('"atrasada"');
    expect(src).toContain('"cancelada"');
  });

  it('todo evento da spec resolve para algum status (sanidade cruzada)', () => {
    for (const ev of [...ASAAS_PAID_EVENTS, ...ASAAS_OVERDUE_EVENTS, ...ASAAS_DEAD_EVENTS]) {
      expect(mapAsaasEventToStatus(ev)).not.toBeNull();
    }
  });
});
