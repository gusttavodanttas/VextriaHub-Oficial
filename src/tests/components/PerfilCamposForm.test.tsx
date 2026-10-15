// Campos do perfil (extraídos de pages/Perfil.tsx): leitura com "+ Adicionar" que liga a
// edição, telefone formatado/validado em edição, CPF/CNPJ sempre não editável.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/components/ui/CityCombobox', () => ({ CityCombobox: ({ value }: { value: string }) => <input aria-label="Cidade" defaultValue={value} /> }));

import { PerfilCamposForm, type PerfilInfo } from '@/components/Perfil/PerfilCamposForm';

const info = (over: Partial<PerfilInfo> = {}): PerfilInfo => ({
  nome: 'Ana', email: 'ana@x.com', telefone: '', endereco: '', oab: '', oab_uf: 'DF', cpf_cnpj: '12345678901', ...over,
});

describe('PerfilCamposForm', () => {
  it('leitura: campos vazios viram "+ Adicionar" que liga o modo de edição; CPF formatado e não editável', () => {
    const setEditMode = vi.fn();
    render(<PerfilCamposForm editMode={false} setEditMode={setEditMode} userInfo={info()} setUserInfo={vi.fn()} />);
    expect(screen.getByText('ana@x.com')).toBeInTheDocument();
    expect(screen.getByText('123.456.789-01')).toBeInTheDocument();
    expect(screen.getByText('Não editável')).toBeInTheDocument();
    const adicionar = screen.getAllByRole('button', { name: '+ Adicionar' });
    expect(adicionar).toHaveLength(3); // telefone, OAB, cidade
    fireEvent.click(adicionar[0]);
    expect(setEditMode).toHaveBeenCalledWith(true);
  });

  it('edição: telefone é formatado ao digitar e avisa quando incompleto; UF aparece só em edição', () => {
    const setUserInfo = vi.fn();
    const { rerender } = render(<PerfilCamposForm editMode setEditMode={vi.fn()} userInfo={info()} setUserInfo={setUserInfo} />);
    fireEvent.change(screen.getByPlaceholderText('(11) 91234-5678'), { target: { value: '11987654321' } });
    expect(setUserInfo).toHaveBeenCalledWith(expect.objectContaining({ telefone: '(11) 98765-4321' }));
    rerender(<PerfilCamposForm editMode setEditMode={vi.fn()} userInfo={info({ telefone: '(11) 9876' })} setUserInfo={setUserInfo} />);
    expect(screen.getByText('Telefone incompleto ou inválido.')).toBeInTheDocument();
    expect(screen.getByText('DF')).toBeInTheDocument();
  });
});
