import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, UserPlus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { onlyDigits } from "@/lib/document";
import { NovoClienteDialog } from "@/components/Clientes/NovoClienteDialog";

interface ClientSelectProps {
  value: string; // client_id
  onValueChange: (value: string, name: string) => void;
  placeholder?: string;
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

// Typeahead: digita o nome → busca entre os cadastrados → seleciona (ou cadastra novo).
// Dropdown inline (sem Radix Popover/portal) para funcionar dentro de Dialogs.
export const ClientSelect: React.FC<ClientSelectProps> = ({ value, onValueChange, placeholder = "Digite o nome do cliente..." }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string, nome: string }[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    if (!user?.office_id) return;
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('office_id', user.office_id)
      .eq('deletado', false)
      .order('nome');
    if (!error) setClients(data || []);
  }, [user?.office_id]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const selectedClient = clients.find((c) => c.id === value);
  const selectedName = selectedClient?.nome ?? '';

  // Quando fechado, o campo mostra o cliente selecionado (ou vazio).
  // Quando aberto, o texto é controlado pelo usuário (busca).
  useEffect(() => { if (!open) setQuery(selectedName); }, [open, selectedName]);

  // Fecha ao clicar fora / ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const filtered = useMemo(() => {
    const q = norm(query);
    const base = q ? clients.filter((c) => norm(c.nome).includes(q)) : clients;
    return base.slice(0, 50);
  }, [clients, query]);

  const pick = (id: string, nome: string) => { onValueChange(id, nome); setQuery(nome); setOpen(false); };

  const openCreate = () => { setOpen(false); setCreateOpen(true); };

  // Cadastra um novo cliente na hora e já seleciona
  const handleCreate = async (c: any): Promise<boolean> => {
    if (!user?.office_id) return false;
    const payload = {
      nome: c.name, email: c.email || null, telefone: c.phone || null,
      cpf_cnpj: onlyDigits(c.cpfCnpj) || null, tipo_pessoa: c.tipoPessoa,
      origem: c.origem || null, endereco: c.endereco || null,
      status: c.status || 'Ativo', data_aniversario: c.dataAniversario || null,
      user_id: user.id, office_id: user.office_id,
    };
    const { data: created, error } = await supabase.from('clientes').insert(payload).select('id, nome').single();
    if (error || !created) {
      toast({ title: "Erro ao cadastrar cliente", description: error?.message, variant: "destructive" });
      return false;
    }
    await fetchClients();
    onValueChange(created.id, created.nome);
    toast({ title: "Cliente cadastrado", description: `${created.nome} vinculado.` });
    return true;
  };

  return (
    <>
      <div className="relative" ref={rootRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && open && filtered[0]) { e.preventDefault(); pick(filtered[0].id, filtered[0].nome); } }}
            placeholder={placeholder}
            className="w-full h-10 rounded-xl border border-input bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          {(query || value) && (
            <button type="button" title="Limpar"
              onClick={() => { onValueChange('', ''); setQuery(''); setOpen(true); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => pick(client.id, client.nome)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === client.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{client.nome}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground/60">
                  {query.trim() ? `Nenhum cliente com "${query.trim()}".` : "Nenhum cliente cadastrado."}
                </p>
              )}
              <button
                type="button"
                onClick={openCreate}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 transition-colors border-t border-border mt-1"
              >
                <UserPlus className="h-4 w-4 shrink-0" /> Cadastrar novo cliente
              </button>
            </div>
          </div>
        )}
      </div>

      <NovoClienteDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
    </>
  );
};
