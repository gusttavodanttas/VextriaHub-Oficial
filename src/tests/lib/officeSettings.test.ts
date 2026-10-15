// Trava o contrato de patchOfficeSettings, o único caminho de escrita em
// offices.settings: releitura com erro aborta (senão o merge partia de {} e
// apagava as outras chaves) e UPDATE bloqueado pela RLS (0 linhas) lança.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patchOfficeSettings } from '@/lib/officeSettings';
import { PERMISSAO_NEGADA } from '@/lib/errors';

interface ReadResult { data: { settings?: Record<string, unknown> } | null; error: { message: string } | null }
interface WriteResult { data: Array<{ id: string }> | null; error: { message: string } | null }

let readResult: ReadResult;
let writeResult: WriteResult;
const updateSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const readChain = {
    eq: () => readChain,
    maybeSingle: (): Promise<ReadResult> => Promise.resolve(readResult),
  };
  const writeChain = {
    eq: () => writeChain,
    select: (): Promise<WriteResult> => Promise.resolve(writeResult),
  };
  return {
    supabase: {
      from: () => ({
        select: () => readChain,
        update: (patch: Record<string, unknown>) => { updateSpy(patch); return writeChain; },
      }),
    },
  };
});

describe('patchOfficeSettings', () => {
  beforeEach(() => {
    updateSpy.mockClear();
    readResult = { data: { settings: { tipos_processo: ['A'], fiscal: { cnpj: '1' } } }, error: null };
    writeResult = { data: [{ id: 'office-1' }], error: null };
  });

  it('mescla o patch preservando as outras chaves do jsonb', async () => {
    const merged = await patchOfficeSettings('office-1', { origens_cliente: ['Site'] });
    expect(merged).toEqual({ tipos_processo: ['A'], fiscal: { cnpj: '1' }, origens_cliente: ['Site'] });
    expect(updateSpy).toHaveBeenCalledWith({ settings: merged });
  });

  it('releitura com erro aborta ANTES de gravar (não mescla em cima de {})', async () => {
    readResult = { data: null, error: { message: 'network down' } };
    await expect(patchOfficeSettings('office-1', { origens_cliente: [] })).rejects.toEqual({ message: 'network down' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('UPDATE bloqueado pela RLS (0 linhas, sem erro) lança PERMISSAO_NEGADA', async () => {
    writeResult = { data: [], error: null };
    await expect(patchOfficeSettings('office-1', { x: 1 })).rejects.toThrow(PERMISSAO_NEGADA);
  });

  it('erro no UPDATE é repassado', async () => {
    writeResult = { data: null, error: { message: 'constraint' } };
    await expect(patchOfficeSettings('office-1', { x: 1 })).rejects.toEqual({ message: 'constraint' });
  });
});
